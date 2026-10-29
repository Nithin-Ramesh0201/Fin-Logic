const Groq = require('groq-sdk');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const apiKey = process.env.GROQ_API_KEY;

// 1. Initialize Groq Config
let groq;
try {
    if (apiKey) {
        groq = new Groq({ apiKey });
    }
} catch (error) {
    console.warn("Groq API Key missing or invalid.");
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// 2. Generic Call Function (Requested)
async function callGroq(prompt, model = DEFAULT_MODEL) {
    if (!groq) throw new Error("Groq API not configured.");

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: model,
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 600
        });

        return completion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Groq Call Error:", error);
        throw error;
    }
}

// 3. Specialized Analysis Function (For App)
const SYSTEM_PROMPT = `
You are an expert financial contract analyzer. Your job is to identify risky clauses in financial documents.
Return the output MERELY as a valid JSON array of objects. Do not include markdown formatting.
Fields: clause, label, riskLevel (High/Medium/Low), whatItMeans, whyHarmful, realExample (in INR), saferAlternative.
If no risks found, return [].
`;

async function analyzeWithGroq(text) {
    if (!groq) throw new Error("Groq API not configured. Please set GROQ_API_KEY.");

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: text }
            ],
            model: DEFAULT_MODEL, // Using 70b-versatile for best analysis
            temperature: 0.1, // Low temp for JSON stability
        });

        const content = completion.choices[0]?.message?.content || "[]";
        // Clean markdown if present
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanContent);

    } catch (error) {
        console.error("Analysis Error:", error);
        throw new Error(`Analysis Failed: ${error.message}`);
    }
}

// 4. Connection Test
async function testGroqConnection() {
    try {
        // Using callGroq to verify the generic function works
        const message = await callGroq("Say 'Groq is ready' in one short sentence.");
        return { success: true, message: message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

const CLAUSE_PROMPT = `You are a financial risk reviewer.
Explain ONLY what is clearly written.
Do NOT guess.

Respond exactly:

Risk Highlight:
Why it is risky (simple language):
Estimated possible loss (rough ₹ value):
Safer rewrite suggestion:
Dark pattern label (choose one: Hidden Fees, Auto-Renew Trap, Interest Trap, Penalty Trap, Forced Consent, Not risky):

Clause:
`;

async function analyzeClauseRisk(clause) {
    const prompt = CLAUSE_PROMPT + clause;
    return await callGroq(prompt, 'llama-3.1-8b-instant');
}

const LOSS_PROMPT = `Estimate realistic possible money loss from this clause for an average Indian user.

Output:
- only a number with ₹ sign
- no explanation
- if uncertain: Unknown

Clause:
`;

async function estimateLoss(clause) {
    const prompt = LOSS_PROMPT + clause;
    // model can be the same lightweight one
    return await callGroq(prompt, 'llama-3.1-8b-instant');
}

const VALIDATION_PROMPT = `Check if this explanation strictly matches the clause and does not assume anything.

If any guess exists:
Reply exactly: Uncertain

If everything matches:
Reply exactly: Correct

Clause:
`;

async function validateExplanation(clause, explanation) {
    const prompt = `${VALIDATION_PROMPT}"${clause}"

Explanation:
"${explanation}"`;
    
    return await callGroq(prompt, 'llama-3.1-8b-instant');
}

module.exports = {
    callGroq,
    analyzeWithGroq,
    analyzeClauseRisk,
    estimateLoss,
    validateExplanation,
    testGroqConnection,
    isConfigured: !!apiKey
};
