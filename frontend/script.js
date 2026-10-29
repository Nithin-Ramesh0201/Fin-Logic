const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('results');
const analysisContainer = document.getElementById('analysis-container');
const analysisContent = document.getElementById('analysis-content');
const loader = document.getElementById('loader');
const fileInfo = document.getElementById('file-info');
const textInput = document.getElementById('textInput');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

let selectedFile = null;
let activeMode = 'upload'; // 'upload' or 'paste'

// Tabs Logic
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = `tab-${tab.dataset.tab}`;
        document.getElementById(targetId).classList.add('active');
        activeMode = tab.dataset.tab;
    });
});

// File Handling
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#0f172a'; });
dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = '#e2e8f0'; });
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#e2e8f0';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    selectedFile = file;
    fileInfo.textContent = `Selected: ${file.name}`;
    fileInfo.classList.remove('hidden');
}

// Analyze
// Analyze
analyzeBtn.addEventListener('click', async () => {
    // Validation
    if (activeMode === 'upload' && !selectedFile) {
        showError('Please select a file to analyze.');
        return;
    }
    if (activeMode === 'paste' && !textInput.value.trim()) {
        showError('Please paste some text to analyze.');
        return;
    }

    // UI Reset
    resultsSection.classList.remove('hidden');
    loader.classList.remove('hidden');
    analysisContainer.classList.add('hidden');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    
    try {
        let response;

        if (activeMode === 'upload') {
            const formData = new FormData();
            formData.append('document', selectedFile);
            response = await fetch('/api/analyze-document', { method: 'POST', body: formData });
        } else {
            response = await fetch('/api/analyze-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textInput.value })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }

        if (data.success) {
            renderResults(data.results, data.source);
            loader.classList.add('hidden');
            analysisContainer.classList.remove('hidden');
            
            // Save report to Firebase (simplified for now)
            // Save report to Firebase
            const inputText = activeMode === 'upload' ? "PDF Upload" : textInput.value;
            await saveCurrentReport(data.results, inputText, activeMode, null);
        } else {
            throw new Error(data.error || 'Analysis failed');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        loader.classList.add('hidden');
        showError(`Analysis failed: ${error.message}. Please try again.`);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Risk Level';
    }
});

function parseAnalysisText(text) {
    const result = {};
    const lines = text.split('\n');
    let currentKey = null;

    lines.forEach(line => {
        if (line.includes(':')) {
            const [key, ...val] = line.split(':');
            currentKey = key.trim().toLowerCase();
            result[currentKey] = val.join(':').trim();
        } else if (currentKey && line.trim()) {
            result[currentKey] += ' ' + line.trim();
        }
    });
    return result;
}

function renderResults(risks, source) {
    resultsSection.classList.remove('hidden');
    analysisContainer.classList.remove('hidden');
    analysisContent.innerHTML = '';
    
    if (!risks || risks.length === 0) {
        analysisContent.innerHTML = '<div class="card safe"><h3>✅ No apparent risks found</h3><p>The automated scan did not detect common risky patterns.</p></div>';
        return;
    }

    risks.forEach((risk, index) => {
        const card = document.createElement('div');
        
        // Parse the text analysis if available
        let parsed = {};
        if (risk.analysis && !risk.analysis.includes("AI Analysis Failed")) {
            parsed = parseAnalysisText(risk.analysis);
        }

        // Determine CSS class
        let cssClass = 'med-risk';
        if (risk.analysis && risk.analysis.toLowerCase().includes('high risk')) cssClass = 'high-risk';
        if (risk.riskType === 'High') cssClass = 'high-risk';

        card.className = `card ${cssClass}`;
        card.style.animationDelay = `${index * 0.1}s`;

        // Validation status logic
        const confidence = risk.validation ? risk.validation : "Not confident — please verify manually.";
        const isConfidenceWarning = !confidence.includes("Correct");

        card.innerHTML = `
            <div class="card-header">
                <h3>${parsed['risk highlight'] || risk.riskType || 'Risk Detected'}</h3>
                ${source === 'regex-only' ? '<span class="status-badge warning">Regex Only</span>' : ''}
            </div>
            <div class="card-body">
                <div class="clause-box">"${risk.clause}"</div>
                
                ${parsed['why it is risky'] ? `
                <div class="friendly-section">
                    <div class="friendly-item">
                        <h4>Why it is risky</h4>
                        <p>${parsed['why it is risky']}</p>
                    </div>
                     <div class="friendly-item highlight-box">
                        <h4>Estimated Loss</h4>
                        <p class="loss-highlight">${risk.estimatedLoss || parsed['estimated possible loss'] || 'Unknown'}</p>
                    </div>
                </div>
                ` : `<p>${risk.analysis}</p>`}

                ${parsed['safer rewrite suggestion'] ? `
                <div class="rewrite-box">
                    <div class="rewrite-header">
                        <h4>Safer Rewrite</h4>
                        <button class="copy-btn" data-copy="${parsed['safer rewrite suggestion']}">
                            Copy
                        </button>
                    </div>
                    <p class="rewrite-text">${parsed['safer rewrite suggestion']}</p>
                </div>
                ` : ''}

                <div class="validation-box ${isConfidenceWarning ? 'warning-bg' : 'success-bg'}" style="margin-top: 1rem; padding: 0.5rem; border-radius: 4px; font-size: 0.9rem;">
                    <strong>Confidence:</strong> ${confidence}
                </div>
            </div>
        `;

        analysisContent.appendChild(card);
    });
    
    // Add Disclaimer
    const disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer-note';
    disclaimer.style = 'grid-column: 1 / -1; text-align: center; margin-top: 2rem; color: #888; font-size: 0.8rem;';
    disclaimer.innerText = "This tool is educational only — not legal advice.";
    analysisContent.appendChild(disclaimer);
}

// Clipboard Copy Logic
document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('copy-btn')) return;

    const text = e.target.dataset.copy;
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        const original = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => {
            e.target.textContent = original;
        }, 1500);
    } catch (err) {
        console.error('Copy failed', err);
    }
});


// Firebase Integration
const loginBtn = document.getElementById('loginBtn');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');

// Login button handler
if (loginBtn) {
    loginBtn.style.display = 'block'; // Ensure visible initially
    loginBtn.addEventListener('click', async () => {
        await signInWithGoogle();
    });
}

// Gemini Test button handler


// History button handler
// History button handler
if (historyBtn) {
    historyBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('Please sign in to view history');
            return;
        }
        
        historyModal.classList.remove('hidden');
        await loadHistory();
    });
}

// Close modal
if (closeHistoryModal) {
    closeHistoryModal.addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });
}

// Close modal on outside click
historyModal?.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.classList.add('hidden');
    }
});

// Save report after analysis
// Save report after analysis
async function saveCurrentReport(analysis, inputText, inputType, fileName) {
    if (!currentUser) {
        alert('ℹ️ Tip: Sign in with Google to save your analysis history!');
        console.log('Skipping save: Not signed in');
        return;
    }
    
    if (!isFirebaseConfigured) {
        console.error('Skipping save: Firebase not configured');
        alert('⚠️ Error: Firebase is not configured correctly. Data cannot be saved.');
        return;
    }
    
    const reportData = {
        inputText: inputText.substring(0, 500), // Limit text size
        inputType,
        fileName: fileName || null,
        analysis,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Use client-side save which handles Firestore SDK
        const saved = await saveReport(reportData);
        if (saved) {
            console.log('Report saved successfully');
            // Show simple toast or log
            const btn = document.getElementById('historyBtn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Saved';
            setTimeout(() => btn.textContent = originalText, 2000);
        }
    } catch (error) {
        console.error('Failed to save report:', error);
    }
}

// Load and display history
async function loadHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<p class="loading">Loading history...</p>';
    
    const reports = await fetchHistory();
    
    if (reports.length === 0) {
        historyList.innerHTML = '<p class="empty">No analysis history yet. Start by analyzing a document!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    reports.forEach(report => {
        const card = document.createElement('div');
        card.className = 'history-card';
        
        const date = report.timestamp?.toDate ? report.timestamp.toDate() : new Date(report.timestamp);
        const dateStr = date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const riskCount = report.analysis?.length || 0;
        const preview = report.inputText?.substring(0, 100) || 'No preview available';
        
        card.innerHTML = `
            <div class="history-header">
                <span class="history-date">${dateStr}</span>
                <span class="history-type">${report.inputType === 'upload' ? '📄 Upload' : '📝 Paste'}</span>
            </div>
            <p class="history-preview">${preview}...</p>
            <div class="history-footer">
                <span class="history-risks">${riskCount} risk(s) detected</span>
                <button class="btn-view-report" data-report-id="${report.id}">View Report</button>
            </div>
        `;
        
        historyList.appendChild(card);
    });
    
    // Add click handlers to view buttons
    document.querySelectorAll('.btn-view-report').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const reportId = e.target.dataset.reportId;
            await viewReport(reportId);
        });
    });
}

// View a specific report
async function viewReport(reportId) {
    const report = await getReport(reportId);
    
    if (!report) {
        alert('Report not found');
        return;
    }
    
    // Close history modal
    historyModal.classList.add('hidden');
    
    // Display the report
    resultsSection.classList.remove('hidden');
    analysisContainer.classList.remove('hidden');
    loader.classList.add('hidden');
    
    renderResults(report.analysis);
    
    // Optionally populate input field
    if (report.inputType === 'paste' && report.inputText) {
        textInput.value = report.inputText;
        // Switch to paste tab
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="paste"]').classList.add('active');
        document.getElementById('tab-paste').classList.add('active');
        activeMode = 'paste';
    }
}

var mybutton = document.getElementById("scrollToTop")

window.onscroll=function() {scrollFunction()}

function scrollFunction(){
    if(document.body.scrollTop>20||document.documentElement.scrollTop>20){mybutton.style.display="block"}
    else{mybutton.style.display="none"}
}

mybutton.onclick=function(){
    scrollToTop();
}

function scrollToTop(){
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    })
}
