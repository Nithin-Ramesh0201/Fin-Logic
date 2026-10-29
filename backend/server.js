
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { extractText } = require('./analysis');
const { getFlaggedClauses } = require('./preprocessing');
const { analyzeWithGroq, analyzeClauseRisk, estimateLoss, validateExplanation, testGroqConnection, isConfigured: isGroqConfigured } = require('./groq-service');

// Load environment variables from .env file (kept in project root)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Middleware
app.use(cors());
app.use(express.json()); // Enable JSON body parsing for text input
app.use(express.static(FRONTEND_DIR)); // Serve frontend files

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to handle file size errors
const uploadMiddleware = (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Upload error: ' + err.message });
    }
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Analysis Route
app.post('/analyze', uploadMiddleware, async (req, res) => {
  let text = '';

  try {
    // Case 1: File Upload
    if (req.file) {
      const filePath = req.file.path;
      text = await extractText(filePath);
    } 
    // Case 2: Pasted Text
    else if (req.body.text) {
      text = req.body.text;
    } 
    else {
      return res.status(400).json({ error: 'No file or text provided.' });
    }

    // 2. AI Analysis using Groq
    let analysis = [];
    if (isGroqConfigured) {
        console.log("Analyzing with Groq...");
        analysis = await analyzeWithGroq(text);
    } else {
        // Fallback to basic rule-based if Groq not configured
        console.log("Groq not configured, using legacy analysis");
        const { analyzeText: legacyAnalyze } = require('./analysis');
        analysis = await legacyAnalyze(text);
    }

    res.json({
      success: true,
      textPreview: text.substring(0, 500) + '...',
      analysis: analysis
    });

  } catch (error) {
    console.error('Processing Error:', error);
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
});

// New Detailed Analysis Route
app.post('/api/analyze-document', uploadMiddleware, async (req, res) => {
    let text = '';
    
    try {
        if (req.file) {
            text = await extractText(req.file.path);
        } else if (req.body.text) {
            text = req.body.text;
        } else {
            return res.status(400).json({ error: 'No text or file provided' });
        }

        // 1. Run Regex Layer
        const flaggedClauses = getFlaggedClauses(text);
        console.log(`Found ${flaggedClauses.length} suspicious clauses via regex.`);

        if (!isGroqConfigured) {
             // Return just the regex matches if Groq is down/missing
            return res.json({ 
                success: true, 
                source: 'regex-only',
                results: flaggedClauses.map(f => ({ clause: f.clause, analysis: `Risk Detected: ${f.risk} (AI Analysis Unavailable)` }))
            });
        }

        // 2. Groq Analysis for each flagged clause
        // Using Promise.all for parallel execution
        const analysisPromises = flaggedClauses.map(async (item) => {
            try {
                // Run analysis, loss estimation, and subsequent validation
                // We must run analysis first to have something to validate
                const analysisText = await analyzeClauseRisk(item.clause);
                const lossEstimate = await estimateLoss(item.clause);

                // Validation Step
                const validationResult = await validateExplanation(item.clause, analysisText);
                const isTrusted = validationResult.trim().includes("Correct");

                const finalAnalysis = isTrusted 
                    ? analysisText 
                    : "Not confident — please verify manually.\n\n" + analysisText; // Keeping original text but with warning

                return {
                    clause: item.clause,
                    riskType: item.risk, // from regex
                    analysis: finalAnalysis,
                    estimatedLoss: lossEstimate,
                    validation: validationResult.trim() // Optional: include validation status for debug
                };
            } catch (err) {
                console.error(`Failed to analyze clause: "${item.clause.substring(0, 30)}..."`, err);
                return {
                    clause: item.clause,
                    riskType: item.risk,
                    analysis: "AI Analysis Failed for this clause.",
                    estimatedLoss: "Unknown"
                };
            }
        });

        const results = await Promise.all(analysisPromises);

        res.json({
            success: true,
            results: results
        });

    } catch (error) {
        console.error('Document Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Firebase endpoints (optional - only work if Firebase is configured)
const { db, isConfigured } = require('./firebase-config');

app.post('/api/save-report', async (req, res) => {
  if (!isConfigured) {
    return res.json({ success: false, message: 'Firebase not configured' });
  }
  
  const { userId, reportData } = req.body;
  
  if (!userId || !reportData) {
    return res.status(400).json({ success: false, error: 'Missing userId or reportData' });
  }
  
  try {
    const docRef = await db.collection('users').doc(userId)
      .collection('reports').add({
        ...reportData,
        timestamp: new Date()
      });
    
    res.json({ success: true, reportId: docRef.id });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/:userId', async (req, res) => {
  if (!isConfigured) {
    return res.json({ success: false, message: 'Firebase not configured', reports: [] });
  }
  
  const { userId } = req.params;
  
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('reports')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const reports = [];
    snapshot.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message, reports: [] });
  }
});

app.get('/api/report/:userId/:reportId', async (req, res) => {
  if (!isConfigured) {
    return res.json({ success: false, message: 'Firebase not configured' });
  }
  
  const { userId, reportId } = req.params;
  
  try {
    const doc = await db.collection('users').doc(userId)
      .collection('reports').doc(reportId).get();
    
    if (doc.exists) {
      res.json({ success: true, report: { id: doc.id, ...doc.data() } });
    } else {
      res.status(404).json({ success: false, error: 'Report not found' });
    }
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Groq API Test Route
app.get('/api/test-groq', async (req, res) => {
  if (!isGroqConfigured) {
    return res.json({
      success: false,
      message: 'Groq API not configured. Set GROQ_API_KEY environment variable.'
    });
  }

  const result = await testGroqConnection();
  
  if (result.success) {
      res.json({
          success: true,
          message: 'Groq API is working!',
          response: result.message
      });
  } else {
      res.status(500).json({
          success: false,
          error: result.error
      });
  }
});

// Serve Firebase Config
app.get('/api/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
