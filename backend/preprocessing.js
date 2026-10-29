/**
 * Preprocessing Layer for Financial Document Analysis
 * Goals: Split document into clauses and flag suspicious clauses before AI analysis.
 */

// 3. Patterns to detect
const RISK_PATTERNS = [
    { pattern: /auto-?renew|renew automatically/i, label: "Auto Renewal" },
    { pattern: /without prior notice|without notification|without prior intimation|sole discretion|reserves the right to modify/i, label: "Forced Consent" },
    { pattern: /processing fee|service charge|maintenance fee/i, label: "Hidden Fee" },
    { pattern: /non-?refundable|no refund/i, label: "No Refund" },
    { pattern: /late fee|delay charge|penalty/i, label: "Penalty" },
    { pattern: /variable interest|interest may increase|dynamic interest|modify the annual percentage rate|modify the apr/i, label: "Variable Interest" },
    { pattern: /cancellation fee|termination fee/i, label: "Cancellation Fee" },
    { pattern: /hidden charges|additional charges may apply/i, label: "Hidden Charges" },
    { pattern: /third[- ]party charges/i, label: "Third Party Charges" },
    { pattern: /minimum balance|minimum amount required/i, label: "Minimum Balance" },
    { pattern: /convenience fee/i, label: "Convenience Fee" },
    { pattern: /lock-in period/i, label: "Lock-in Period" },
    { pattern: /pre-?closure charge|foreclosure fee/i, label: "Pre-closure Charge" },
    { pattern: /share.*data|third-?party marketing|sell.*data|share.*credit history|irrevocable.*license/i, label: "Data Privacy" }
];

// 1. Helper function: Split into clauses
function splitIntoClauses(text) {
    if (!text) return [];
    
    // Split by common clause delimiters: periods, semicolons, newlines
    // We filter out empty strings after splitting
    return text
        .split(/[.;\n]+/)
        .map(clause => clause.trim())
        .filter(clause => clause.length > 0);
}

// 2. Detector function
function detectClauseRisk(clause) {
    for (const { pattern, label } of RISK_PATTERNS) {
        if (pattern.test(clause)) {
            return label;
        }
    }
    return null;
}

// 4. Main Function: Get Flagged Clauses
function getFlaggedClauses(text) {
    const clauses = splitIntoClauses(text);
    const flaggedClauses = [];

    clauses.forEach(clause => {
        const riskLabel = detectClauseRisk(clause);
        if (riskLabel) {
            flaggedClauses.push({
                clause: clause,
                risk: riskLabel
            });
        }
    });

    return flaggedClauses;
}

module.exports = {
    splitIntoClauses,
    detectClauseRisk,
    getFlaggedClauses
};
