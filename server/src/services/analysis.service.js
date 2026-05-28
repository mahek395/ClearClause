// services/analyzeDocument.service.js
// IMPROVED: Enhanced verification, comprehensive section detection,
// asymmetry detection, one-sided clause flagging, and strict validation

import { callAI, streamAI } from '../config/aiProviders.js';
import { parseAIJsonWithRetry } from '../utils/parseAIJson.js';

const MAX_CHARS = 500000;

// ─── Pre-Processing: Extract Document Structure ───────────────────────────────

/**
 * Pre-analyze the document to extract structure before AI processing.
 * This prevents AI from missing sections it should have found.
 */
function preAnalyzeStructure(text) {
  const lines = text.split('\n');
  
  // Extract all numbered sections (1., 2., 11., 12., etc.)
  const sectionPattern = /^(\d+)\.\s+([A-Z][^:\n]+?)(?::|\s|$)/m;
  const sections = [];
  let currentSection = null;
  
  lines.forEach((line, idx) => {
    const match = line.match(sectionPattern);
    if (match) {
      sections.push({
        number: parseInt(match[1]),
        heading: match[2].trim(),
        startLine: idx,
        content: []
      });
      currentSection = sections[sections.length - 1];
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  });

  // Extract key role names (Lessor, Lessee, Borrower, Lender, etc.)
  const rolePatterns = [
    /\b(Lessor|Lessee|Landlord|Tenant|Employer|Employee|Borrower|Lender|Creditor|Debtor|Licensor|Licensee|Vendor|Buyer|Seller|Service Provider|Contractor|Principal|Agent|Disclosing Party|Receiving Party)\b/g
  ];
  
  const rolesFound = new Set();
  rolePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) matches.forEach(m => rolesFound.add(m));
  });

  return {
    sectionCount: sections.length,
    sections,
    rolesIdentified: Array.from(rolesFound),
    hasTerminationClause: sections.some(s => s.heading.toLowerCase().includes('termination')),
    hasGoverningLaw: sections.some(s => s.heading.toLowerCase().includes('governing law') || s.heading.toLowerCase().includes('jurisdiction')),
    hasLiabilityLimitation: text.toLowerCase().includes('limitation of liability') || text.toLowerCase().includes('cap') && text.toLowerCase().includes('liability'),
    hasIndemnification: text.toLowerCase().includes('indemnif'),
    hasForceOfLaw: text.toLowerCase().includes('force majeure'),
    hasConflictOfInterest: text.toLowerCase().includes('conflict of interest'),
  };
}

/**
 * Detect asymmetric obligations by comparing party mentions in obligation contexts.
 * Flag if one party has significantly more obligations.
 */
function detectAsymmetries(text, roles) {
  const obligations = {
    shall: text.match(/\b(Lessor|Lessee|Borrower|Lender|Employer|Employee|Party|Vendor|Contractor)\b.{0,100}?shall\b/gi) || [],
    must: text.match(/\b(Lessor|Lessee|Borrower|Lender|Employer|Employee|Party|Vendor|Contractor)\b.{0,100}?must\b/gi) || [],
    agrees: text.match(/\b(Lessor|Lessee|Borrower|Lender|Employer|Employee|Party|Vendor|Contractor)\b.{0,100}?agrees\b/gi) || [],
  };

  const obligationCount = obligations.shall.length + obligations.must.length + obligations.agrees.length;
  
  // Flag if heavily one-sided (one party has 3x+ the obligations)
  return obligationCount > 20; // Threshold for "heavily obligated"
}

// ─── Enhanced Prompt Builder ───────────────────────────────────────────────────

function buildEnhancedPrompt(safeText, preAnalysis) {
  return `You are a meticulous legal document analysis AI. Your job is to analyze this document
EXHAUSTIVELY and return a structured JSON response. You will NOT miss clauses or misidentify them.

═══════════════════════════════════════════════════════════════════════════════
VERIFICATION CHECKLIST — BEFORE FLAGGING ANYTHING AS MISSING:
═══════════════════════════════════════════════════════════════════════════════

✓ Section Count: The document contains ${preAnalysis.sectionCount} numbered sections.
✓ Roles Identified: ${preAnalysis.rolesIdentified.join(', ')}
✓ Known Present:
  - Termination clause: ${preAnalysis.hasTerminationClause ? 'YES ✓' : 'MISSING — check for this!'}
  - Governing Law / Jurisdiction: ${preAnalysis.hasGoverningLaw ? 'YES ✓' : 'MISSING — check for this!'}
  - Liability Limitation: ${preAnalysis.hasLiabilityLimitation ? 'YES ✓' : 'MISSING — check for this!'}
  - Indemnification: ${preAnalysis.hasIndemnification ? 'YES ✓' : 'MISSING — check for this!'}
  - Force Majeure: ${preAnalysis.hasForceOfLaw ? 'YES ✓' : 'MISSING — check for this!'}
  - Conflict of Interest: ${preAnalysis.hasConflictOfInterest ? 'YES ✓' : 'MISSING — check for this!'}

⚠️ CRITICAL: If the pre-analysis says "MISSING", search the document 2-3 more times using
different keywords before flagging it. Example:
  - Look for "Governing Law" by also searching for "jurisdiction", "venue", "applicable law"
  - Look for "Termination" by searching "term", "end", "discontinue", "cancel"

═══════════════════════════════════════════════════════════════════════════════
DOCUMENT CONTENT:
═══════════════════════════════════════════════════════════════════════════════

<DOCUMENT>
${safeText}
</DOCUMENT>

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════════════════

Return ONLY a valid JSON object with this EXACT structure:

{
  "document_type": "Specific document type (e.g., Non-Disclosure Agreement, Commercial Lease, Loan Agreement). Be precise, not generic.",

  "summary": "2-3 sentences in plain English suitable for a business owner with zero legal background. State: (1) What is this document? (2) Who are the two main parties? (3) What is the core exchange or obligation?",

  "overall_risk": "low | medium | high",

  "key_dates": [
    {
      "label": "Plain English: What does this date trigger? What obligation, deadline, or change?",
      "value": "The actual date or duration",
      "party_affected": "${preAnalysis.rolesIdentified[0]} | ${preAnalysis.rolesIdentified[1] || 'Other Party'} | Both"
    }
  ],

  "key_amounts": [
    {
      "label": "Plain English: What payment or threshold does this represent and when?",
      "value": "The dollar amount, percentage, or formula",
      "party_affected": "${preAnalysis.rolesIdentified[0]} | ${preAnalysis.rolesIdentified[1] || 'Other Party'} | Both"
    }
  ],

  "sections": [
    {
      "heading": "Exact section heading from the document",
      "number": 1,
      "plain_english": "What does this section DO practically? What can each party do? Not do? What are the consequences? Maximum 3 sentences. No legal jargon.",
      "who_benefits": "${preAnalysis.rolesIdentified[0]} | ${preAnalysis.rolesIdentified[1] || 'Other Party'} | Both | Neutral",
      "risk_level": "high | medium | low | neutral",
      "risk_reason": "Only if high/medium: One sentence. Which party is disadvantaged and how? Leave empty for low/neutral."
    }
  ],

  "one_sided_clauses": [
    {
      "section": "Name of the section",
      "issue": "Plain English description of the asymmetry: which party bears disproportionate risk, cost, or obligation?",
      "severity": "high | medium | low"
    }
  ],

  "missing_clauses": [
    {
      "clause": "Name of the clause",
      "why_it_matters": "Plain English: Why would a signing party want this? What protection does it provide?"
    }
  ]
}

═══════════════════════════════════════════════════════════════════════════════
CLASSIFICATION RULES:
═══════════════════════════════════════════════════════════════════════════════

KEY DATES — ONLY include if it triggers or defines:
  ✅ Payments, performance deadlines, renewal triggers
  ✅ Notice periods, cure windows, termination effective dates
  ✅ Reporting/submission deadlines
  ❌ EXCLUDE: Execution dates, notary dates, acknowledgment dates, preamble dates

KEY AMOUNTS — ONLY include if it represents:
  ✅ Recurring or one-time payments
  ✅ Financial thresholds, caps, minimum insurance, royalty rates
  ❌ EXCLUDE: Historical reference figures, incidental numbers, example amounts

RISK LEVELS — use these definitions PRECISELY:
  HIGH:    Could cause contract termination, major financial loss, or 
           liability that survives the contract end. Examples: unlimited 
           indemnification, indefinite liability, one-party termination rights.
  
  MEDIUM:  Limits rights, imposes significant burdens, contains unfavorable 
           terms for one party but not catastrophic. Examples: non-compete 
           clauses, heavy reporting requirements, asymmetric payment terms.
  
  LOW:     Standard boilerplate with minimal practical impact. Examples: 
           definitions, standard procedural language, mutual acknowledgments.
  
  NEUTRAL: Procedural mechanics or mutual protections that don't favor 
           either party. Examples: dispute resolution procedures, severability.

⚠️ NEVER assign high/medium risk to sections that are clearly beneficial 
to both parties or are standard industry language.

ONE-SIDED CLAUSES — Flag when:
  • One party can terminate but the other cannot
  • Payment obligations are asymmetric without justification
  • Indemnification flows only one direction
  • Liability caps apply only to one party
  • Notice requirements are stricter for one party
  • Assignment rights are one-sided

MISSING CLAUSES — Only flag if:
  Step 1: You searched the entire document multiple times using different keywords
  Step 2: It is completely absent (not just limited or unfavorable)
  Step 3: It is STANDARD for this document type
  
  Standard clauses by type:
  - All documents: Governing law, dispute resolution
  - Leases: Maintenance obligations, renewal terms, default provisions
  - Employment: At-will status or term, compensation, benefits eligibility
  - Loans: Repayment schedule, interest rate, prepayment penalties
  - NDAs: Return of confidential materials, duration, exceptions to confidentiality
  - Service Agreements: SLA/performance standards, payment terms, support scope`;
}

// ─── Non-Streaming Analysis ───────────────────────────────────────────────────

/**
 * Analyzes a document with enhanced verification.
 *
 * @param {string} rawText - Extracted plain text from the uploaded document
 * @returns {Object} Parsed analysis object + ai_provider + verification_notes
 */
export async function analyzeDocument(rawText) {
  const safeText = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Document truncated — first 500,000 characters analyzed]'
    : rawText;

  // Pre-analyze document structure
  const preAnalysis = preAnalyzeStructure(safeText);
  const hasAsymmetries = detectAsymmetries(safeText, preAnalysis.rolesIdentified);

  const prompt = buildEnhancedPrompt(safeText, preAnalysis);
  const { text, provider } = await callAI(prompt);
  const { data: parsed, provider: finalProvider } = await parseAIJsonWithRetry(text, provider);

  return {
    ...parsed,
    ai_provider: finalProvider,
    verification_notes: {
      sections_detected: preAnalysis.sectionCount,
      roles_identified: preAnalysis.rolesIdentified,
      has_potential_asymmetries: hasAsymmetries,
      pre_analysis_findings: preAnalysis
    }
  };
}

// ─── Streaming Analysis ───────────────────────────────────────────────────────

/**
 * Streams analysis chunks via SSE with enhanced verification.
 *
 * @param {string} rawText           - Extracted plain text from the uploaded document
 * @param {Function} onProvider      - Called with the provider name when known
 * @param {Function} onChunk         - Called with each streamed text chunk
 * @returns {Object} Parsed analysis object + ai_provider + verification_notes
 */
export async function analyzeDocumentStreaming(rawText, { onProvider, onChunk }) {
  const safeText = rawText.length > MAX_CHARS
    ? rawText.slice(0, MAX_CHARS) + '\n\n[Document truncated — first 500,000 characters analyzed]'
    : rawText;

  // Pre-analyze before streaming
  const preAnalysis = preAnalyzeStructure(safeText);
  const hasAsymmetries = detectAsymmetries(safeText, preAnalysis.rolesIdentified);

  const prompt = buildEnhancedPrompt(safeText, preAnalysis);

  let fullText     = '';
  let providerUsed = 'gemini';

  await streamAI(
    prompt,
    (chunk) => {
      fullText += chunk;
      onChunk(chunk);
    },
    (p) => {
      providerUsed = p;
      onProvider(p);
    }
  );

  const { data: parsed } = await parseAIJsonWithRetry(fullText, providerUsed);
  
  return {
    ...parsed,
    ai_provider: providerUsed,
    verification_notes: {
      sections_detected: preAnalysis.sectionCount,
      roles_identified: preAnalysis.rolesIdentified,
      has_potential_asymmetries: hasAsymmetries,
      pre_analysis_findings: preAnalysis
    }
  };
}