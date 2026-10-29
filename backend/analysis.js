const Tesseract = require('tesseract.js');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

/**
 * Perform extraction based on file type.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>} - Extracted text.
 */
async function extractText(filePath) {
  console.log(`[OCR] Starting extraction for: ${filePath}`);
  const startTime = Date.now();
  
  try {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
        // Handle PDF
        console.log('[OCR] Detected PDF. Using pdf-parse...');
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        text = result.text;
    } else {
        // Handle Image (default Tesseract)
        console.log('[OCR] Detected Image. Using Tesseract...');
        const { data: { text: ocrText } } = await Tesseract.recognize(
            filePath,
            'eng',
            { logger: m => { if (m.status === 'recognizing text') console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`); }}
        );
        text = ocrText;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[OCR] Complete in ${duration}s. Extracted ${text.length} characters.`);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted. The file might be empty or contain non-selectable text (scanned PDF without OCR).');
    }
    
    return text;
  } catch (error) {
    console.error('[OCR] Error:', error);
    throw new Error(`Extraction failed: ${error.message}`);
  }
}

/**
 * Enhanced AI Analysis with Pattern Detection.
 * Scans text for risky financial patterns and estimates potential losses.
 * Uses simple, friendly language and INR currency.
 * @param {string} text - The text to analyze.
 * @returns {Promise<Array>} - List of detected risks with structured data.
 */
async function analyzeText(text) {
  console.log('Analyzing text with enhanced pattern detection...');
  
  const risks = [];
  const lowerText = text.toLowerCase();
  
  // Helper to convert USD estimates to INR (approx 83 INR = 1 USD)
  const toINR = (usdAmount) => Math.round(usdAmount * 83);
  
  // Pattern definitions with friendly, simple language
  const patterns = [
    {
      keywords: ['hidden fee', 'processing charge', 'service fee may apply', 'administrative fee', 'handling charge'],
      label: 'Hidden Fee',
      riskLevel: 'High',
      whatItMeans: 'This means they can charge you extra money that wasn\'t clearly mentioned upfront.',
      whyHarmful: 'These surprise charges add up quickly. You might think you\'re paying ₹1000, but end up paying ₹1500 or more.',
      estimator: (text) => {
        const numbers = text.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?/g);
        if (numbers && numbers.length > 0) {
          const amount = parseFloat(numbers[0].replace(/[$,]/g, ''));
          const inrAmount = toINR(amount);
          const yearlyAmount = toINR(amount * 12);
          return `You could lose ₹${inrAmount.toLocaleString('en-IN')} to ₹${yearlyAmount.toLocaleString('en-IN')} per year in unexpected fees.`;
        }
        return 'You could lose ₹4,000 to ₹40,000 per year in unexpected fees.';
      },
      saferAlternative: 'All fees should be listed clearly before you agree. Optional charges should need your permission first.'
    },
    {
      keywords: ['auto-renew', 'automatic renewal', 'automatically renew', 'renew without notice'],
      label: 'Auto Renew',
      riskLevel: 'High',
      whatItMeans: 'Your subscription will continue and charge you automatically, even if you forgot about it or don\'t want it anymore.',
      whyHarmful: 'Many people forget to cancel and end up paying for services they don\'t use. Companies make it hard to cancel on purpose.',
      estimator: (text) => {
        const numbers = text.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?/g);
        if (numbers && numbers.length > 0) {
          const amount = parseFloat(numbers[0].replace(/[$,]/g, ''));
          const inrAmount = toINR(amount);
          return `If you forget to cancel: ₹${inrAmount.toLocaleString('en-IN')} wasted every renewal period.`;
        }
        return 'If you forget to cancel: ₹8,000 to ₹40,000 wasted per year.';
      },
      saferAlternative: 'The service should stop automatically unless you choose to continue. Cancellation should be easy and instant.'
    },
    {
      keywords: ['without prior notice', 'without notice', 'may change at any time', 'at our discretion', 'sole discretion', 'without prior intimation', 'reserves the right to modify'],
      label: 'Forced Consent',
      riskLevel: 'Medium',
      whatItMeans: 'They can change the rules, prices, or terms whenever they want without telling you first.',
      whyHarmful: 'You could wake up to higher prices or worse service with no warning. You lose control over your own money.',
      estimator: () => 'Unpredictable losses - they could increase prices by 20-50% overnight.',
      saferAlternative: 'Any changes should be announced at least 30 days in advance, and you should be able to cancel without penalty if you don\'t like the changes.'
    },
    {
      keywords: ['late fee', 'late payment fee', 'penalty', 'default interest', 'penalty charge'],
      label: 'Penalty Trap',
      riskLevel: 'High',
      whatItMeans: 'If you\'re even one day late with payment, they\'ll charge you extra money as punishment.',
      whyHarmful: 'Late fees can be huge (₹500-₹3000 each time). If you miss one payment, the penalties can snowball quickly.',
      estimator: (text) => {
        const numbers = text.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?/g);
        if (numbers && numbers.length > 0) {
          const amount = parseFloat(numbers[0].replace(/[$,]/g, ''));
          const inrAmount = toINR(amount);
          return `₹${inrAmount.toLocaleString('en-IN')} penalty each time you're late. Could be ₹${(inrAmount * 4).toLocaleString('en-IN')}+ per year.`;
        }
        return '₹2,000 to ₹8,000 in penalties per incident.';
      },
      saferAlternative: 'Late fees should be small (max ₹100) and only charged after a grace period. You should get a reminder before any penalty.'
    },
    {
      keywords: ['dynamic interest', 'variable interest', 'interest may increase', 'rate may change', 'adjustable rate', 'modify the annual percentage rate', 'modify the apr'],
      label: 'Hidden Fee',
      riskLevel: 'High',
      whatItMeans: 'The interest rate on your loan can go up at any time, making you pay more money back.',
      whyHarmful: 'What starts as a 10% loan could become 15% or 20%. You\'ll end up paying thousands more than you expected.',
      estimator: (text) => {
        const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          const baseRate = parseFloat(percentMatch[1]);
          const increase = baseRate * 0.5;
          return `Your interest could increase by ${increase.toFixed(1)}% to ${(increase * 2).toFixed(1)}%, costing you ₹20,000 to ₹4,00,000 extra over the loan period.`;
        }
        return 'Interest increases could cost you ₹50,000 to ₹5,00,000 extra over the loan period.';
      },
      saferAlternative: 'Interest rates should be locked in and can\'t change. Any rate changes should need your written approval.'
    },
    {
      keywords: ['share anonymized data', 'third-party marketing', 'share your data', 'irrevocable license', 'sell your info', 'share credit history'],
      label: 'Data Privacy',
      riskLevel: 'High',
      whatItMeans: 'You are giving them permission to share or sell your personal and financial details to other companies for ads or credit scoring.',
      whyHarmful: 'Your private data (spending habits, credit score) could be sold to advertisers or insurers, leading to spam or higher rates elsewhere.',
      estimator: () => 'Loss of privacy and potential increase in spam/targeted ads.',
      saferAlternative: 'Data sharing should be optional (opt-in) and not required for using the service.'
    }
  ];
  
  // Scan text for each pattern
  patterns.forEach(pattern => {
    const foundKeywords = pattern.keywords.filter(keyword => lowerText.includes(keyword));
    
    if (foundKeywords.length > 0) {
      // Find the sentence containing the keyword for context
      const sentences = text.split(/[.!?]+/);
      const matchingSentence = sentences.find(s => 
        foundKeywords.some(kw => s.toLowerCase().includes(kw))
      ) || foundKeywords[0];
      
      risks.push({
        clause: matchingSentence.trim() || `Detected: ${foundKeywords.join(', ')}`,
        riskLevel: pattern.riskLevel,
        whatItMeans: pattern.whatItMeans,
        whyHarmful: pattern.whyHarmful,
        realExample: pattern.estimator(text),
        saferAlternative: pattern.saferAlternative,
        label: pattern.label,
        // Legacy fields for backward compatibility
        riskHighlight: pattern.label,
        whyRisky: pattern.whyHarmful,
        futureLoss: pattern.estimator(text),
        rewrite: pattern.saferAlternative,
        reason: pattern.whyHarmful,
        futureLossEstimate: pattern.estimator(text),
        saferRewrite: pattern.saferAlternative
      });
    }
  });
  
  // If no risks found
  if (risks.length === 0) {
    risks.push({
      clause: 'Great news! No major red flags detected in this text.',
      riskLevel: 'Low',
      whatItMeans: 'The text you provided doesn\'t contain common predatory patterns.',
      whyHarmful: 'Not applicable - this looks relatively safe.',
      realExample: '₹0 - No hidden costs detected.',
      saferAlternative: 'Keep reading carefully and watch for any unclear terms.',
      label: 'Clean',
      // Legacy fields
      riskHighlight: 'Safe (Low Risk)',
      whyRisky: 'N/A',
      futureLoss: '₹0',
      rewrite: 'N/A',
      reason: 'N/A',
      futureLossEstimate: '₹0',
      saferRewrite: 'N/A'
    });
  }
  
  console.log(`Analysis complete. Found ${risks.length} risk(s).`);
  return risks;
}

module.exports = { extractText, analyzeText };
