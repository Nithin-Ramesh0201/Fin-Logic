// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

// Escape anything coming from the user or the AI before putting it into innerHTML
const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function showToast(message, type = 'info') {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}
const showError = (message) => showToast(message, 'error');

// ---------- Elements & state ----------
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const analyzeBtn = $('analyzeBtn');
const resultsSection = $('results');
const analysisContainer = $('analysis-container');
const analysisContent = $('analysis-content');
const loader = $('loader');
const fileInfo = $('file-info');
const textInput = $('textInput');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

let selectedFile = null;
let activeMode = 'upload'; // 'upload' or 'paste'
let signInTipShown = false;

// ---------- Tabs ----------
function setTab(name) {
    activeMode = name;
    tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
    });
    tabContents.forEach((c) => c.classList.toggle('active', c.id === `tab-${name}`));
}

tabs.forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tab.dataset.tab === 'upload' ? 'paste' : 'upload';
        setTab(next);
        $(`tabbtn-${next}`).focus();
    });
});

// ---------- File handling ----------
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
    if (e.target === dropzone && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInput.click();
    }
});
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        showError('Please choose a PDF or an image file.');
        return;
    }
    selectedFile = file;
    fileInfo.textContent = `Selected: ${file.name}`;
    fileInfo.classList.remove('hidden');
}

// ---------- Analyze ----------
analyzeBtn.addEventListener('click', async () => {
    if (activeMode === 'upload' && !selectedFile) {
        showError('Please select a file to analyze.');
        return;
    }
    if (activeMode === 'paste' && !textInput.value.trim()) {
        showError('Please paste some text to analyze.');
        return;
    }

    resultsSection.classList.remove('hidden');
    loader.classList.remove('hidden');
    analysisContainer.classList.add('hidden');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    resultsSection.setAttribute('aria-busy', 'true');

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
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        if (!data.success) throw new Error(data.error || 'Analysis failed');

        renderResults(data.results, data.source);
        loader.classList.add('hidden');
        analysisContainer.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const inputText = activeMode === 'upload' ? 'PDF Upload' : textInput.value;
        await saveCurrentReport(data.results, inputText, activeMode, null);
    } catch (error) {
        console.error('Analysis error:', error);
        loader.classList.add('hidden');
        showError(`Analysis failed: ${error.message}. Please try again.`);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Risk Level';
        resultsSection.removeAttribute('aria-busy');
    }
});

function parseAnalysisText(text) {
    const result = {};
    let currentKey = null;

    text.split('\n').forEach((line) => {
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
        analysisContent.innerHTML =
            '<div class="card safe"><div class="card-header"><h3>✅ No apparent risks found</h3></div>' +
            '<div class="card-body"><p>The automated scan did not detect common risky patterns.</p></div></div>';
        return;
    }

    risks.forEach((risk, index) => {
        const card = document.createElement('div');

        let parsed = {};
        if (risk.analysis && !risk.analysis.includes('AI Analysis Failed')) {
            parsed = parseAnalysisText(risk.analysis);
        }

        let cssClass = 'med-risk';
        if (risk.analysis && risk.analysis.toLowerCase().includes('high risk')) cssClass = 'high-risk';
        if (risk.riskType === 'High') cssClass = 'high-risk';

        card.className = `card ${cssClass}`;
        card.style.animationDelay = `${index * 0.1}s`;

        const confidence = risk.validation ? risk.validation : 'Not confident — please verify manually.';
        const isConfidenceWarning = !confidence.includes('Correct');
        const rewrite = parsed['safer rewrite suggestion'];

        card.innerHTML = `
            <div class="card-header">
                <h3>${esc(parsed['risk highlight'] || risk.riskType || 'Risk Detected')}</h3>
                ${source === 'regex-only' ? '<span class="status-badge warning">Regex Only</span>' : ''}
            </div>
            <div class="card-body">
                <div class="clause-box">"${esc(risk.clause)}"</div>

                ${parsed['why it is risky'] ? `
                <div class="friendly-section">
                    <div class="friendly-item">
                        <h4>Why it is risky</h4>
                        <p>${esc(parsed['why it is risky'])}</p>
                    </div>
                    <div class="friendly-item highlight-box">
                        <h4>Estimated Loss</h4>
                        <p class="loss-highlight">${esc(risk.estimatedLoss || parsed['estimated possible loss'] || 'Unknown')}</p>
                    </div>
                </div>
                ` : `<p>${esc(risk.analysis)}</p>`}

                ${rewrite ? `
                <div class="rewrite-box">
                    <div class="rewrite-header">
                        <h4>Safer Rewrite</h4>
                        <button type="button" class="copy-btn" data-copy="${esc(rewrite)}">Copy</button>
                    </div>
                    <p class="rewrite-text">${esc(rewrite)}</p>
                </div>
                ` : ''}

                <div class="validation-box ${isConfidenceWarning ? 'warning-bg' : 'success-bg'}">
                    <strong>Confidence:</strong> ${esc(confidence)}
                </div>
            </div>
        `;

        analysisContent.appendChild(card);
    });

    const disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer-note';
    disclaimer.textContent = 'This tool is educational only — not legal advice.';
    analysisContent.appendChild(disclaimer);
}

// ---------- Clipboard ----------
document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('copy-btn')) return;
    const text = e.target.dataset.copy;
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        const original = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = original; }, 1500);
    } catch (err) {
        console.error('Copy failed', err);
        showError('Could not copy to clipboard.');
    }
});

// ---------- Auth & history modal ----------
const loginBtn = $('loginBtn');
const historyBtn = $('historyBtn');
const historyModal = $('historyModal');
const closeHistoryModal = $('closeHistoryModal');
let lastFocused = null;

loginBtn?.addEventListener('click', async () => { await signInWithGoogle(); });

function openHistory() {
    lastFocused = document.activeElement;
    historyModal.classList.remove('hidden');
    closeHistoryModal.focus();
}

function closeHistory() {
    historyModal.classList.add('hidden');
    lastFocused?.focus?.();
}

historyBtn?.addEventListener('click', async () => {
    if (!currentUser) {
        showToast('Please sign in to view history.');
        return;
    }
    openHistory();
    await loadHistory();
});

closeHistoryModal?.addEventListener('click', closeHistory);
historyModal?.addEventListener('click', (e) => { if (e.target === historyModal) closeHistory(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !historyModal.classList.contains('hidden')) closeHistory();
});

// ---------- Save / load reports ----------
async function saveCurrentReport(analysis, inputText, inputType, fileName) {
    if (!currentUser) {
        if (!signInTipShown) {
            signInTipShown = true;
            showToast('Tip: sign in with Google to save your analysis history.');
        }
        return;
    }

    if (!isFirebaseConfigured) {
        console.error('Skipping save: Firebase not configured');
        showError('Firebase is not configured correctly. Data cannot be saved.');
        return;
    }

    const reportData = {
        inputText: inputText.substring(0, 500), // limit stored text size
        inputType,
        fileName: fileName || null,
        analysis,
        timestamp: new Date().toISOString()
    };

    try {
        const saved = await saveReport(reportData);
        if (saved) showToast('✅ Saved to your history', 'success');
    } catch (error) {
        console.error('Failed to save report:', error);
        showError('Could not save this report.');
    }
}

async function loadHistory() {
    const historyList = $('historyList');
    historyList.innerHTML = '<p class="loading">Loading history...</p>';

    const reports = await fetchHistory();

    if (!reports || reports.length === 0) {
        historyList.innerHTML = '<p class="empty">No analysis history yet. Start by analyzing a document!</p>';
        return;
    }

    historyList.innerHTML = '';
    reports.forEach((report) => {
        const card = document.createElement('div');
        card.className = 'history-card';

        const date = report.timestamp?.toDate ? report.timestamp.toDate() : new Date(report.timestamp);
        const dateStr = date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const riskCount = report.analysis?.length || 0;
        const preview = report.inputText?.substring(0, 100) || 'No preview available';

        card.innerHTML = `
            <div class="history-header">
                <span class="history-date">${esc(dateStr)}</span>
                <span class="history-type">${report.inputType === 'upload' ? '📄 Upload' : '📝 Paste'}</span>
            </div>
            <p class="history-preview">${esc(preview)}...</p>
            <div class="history-footer">
                <span class="history-risks">${riskCount} risk(s) detected</span>
                <button type="button" class="btn-view-report" data-report-id="${esc(report.id)}">View Report</button>
            </div>
        `;
        historyList.appendChild(card);
    });
}

// One delegated listener instead of re-binding after every render
$('historyList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-view-report');
    if (btn) await viewReport(btn.dataset.reportId);
});

async function viewReport(reportId) {
    const report = await getReport(reportId);
    if (!report) {
        showError('Report not found.');
        return;
    }

    closeHistory();
    resultsSection.classList.remove('hidden');
    analysisContainer.classList.remove('hidden');
    loader.classList.add('hidden');
    renderResults(report.analysis);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (report.inputType === 'paste' && report.inputText) {
        textInput.value = report.inputText;
        setTab('paste');
    }
}

// ---------- Scroll to top ----------
const topBtn = $('scrollToTop');
window.addEventListener('scroll', () => {
    topBtn.classList.toggle('visible', window.scrollY > 300);
}, { passive: true });
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
