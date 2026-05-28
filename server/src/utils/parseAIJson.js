// utils/parseAIJson.js
// Parses and validates AI JSON output with retry logic.
// Fixed: added schema validation so missing/wrong fields are caught early,
//        better error messages, guards against partially-streamed JSON.

import { callAI } from '../config/aiProviders.js';

// ─── Required Top-Level Fields ────────────────────────────────────────────────
// If the AI returns JSON that is missing any of these, we treat it as a
// parse failure and ask the AI to fix it — same as a syntax error.

const REQUIRED_FIELDS = [
  'document_type',
  'summary',
  'overall_risk',
  'sections',
];

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

// ─── JSON Cleaner ─────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences that some models add despite being told not to.
 * Also handles cases where the model prepends a sentence before the JSON.
 */
function cleanJsonString(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();

  // If the model wrote a sentence before the JSON, find where the object starts
  const firstBrace  = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) return cleaned;

  if (firstBrace === -1) return cleaned.slice(firstBracket);
  if (firstBracket === -1) return cleaned.slice(firstBrace);

  return cleaned.slice(Math.min(firstBrace, firstBracket));
}

// ─── Schema Validator ─────────────────────────────────────────────────────────

/**
 * Validates the parsed object has the shape we expect.
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateSchema(parsed) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, reason: 'Root value is not an object' };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed)) {
      return { valid: false, reason: `Missing required field: "${field}"` };
    }
  }

  if (!VALID_RISK_LEVELS.includes(parsed.overall_risk)) {
    return {
      valid: false,
      reason: `"overall_risk" must be one of: ${VALID_RISK_LEVELS.join(' | ')}. Got: "${parsed.overall_risk}"`,
    };
  }

  if (!Array.isArray(parsed.sections)) {
    return { valid: false, reason: '"sections" must be an array' };
  }

  if (parsed.sections.length === 0) {
    return { valid: false, reason: '"sections" array is empty — document was not analyzed' };
  }

  // Validate each section has minimum required fields
  for (let i = 0; i < parsed.sections.length; i++) {
    const s = parsed.sections[i];
    if (!s.heading || typeof s.heading !== 'string') {
      return { valid: false, reason: `Section at index ${i} is missing a "heading" field` };
    }
    if (!s.plain_english || typeof s.plain_english !== 'string') {
      return { valid: false, reason: `Section "${s.heading}" is missing "plain_english"` };
    }
    if (!['high', 'medium', 'low', 'neutral'].includes(s.risk_level)) {
      return {
        valid: false,
        reason: `Section "${s.heading}" has invalid risk_level: "${s.risk_level}"`,
      };
    }
    // Enforce: risk_reason must be empty string for low/neutral sections
    // This prevents the hardcoded "Why this is risky" bug at the data layer
    if (['low', 'neutral'].includes(s.risk_level) && s.risk_reason && s.risk_reason.trim() !== '') {
      // Auto-fix instead of failing — just clear the risk_reason
      parsed.sections[i].risk_reason = '';
    }
  }

  // Validate missing_clauses shape if present
  if (parsed.missing_clauses && Array.isArray(parsed.missing_clauses)) {
    parsed.missing_clauses = parsed.missing_clauses.map((m, i) => {
      // Normalize string items to the object shape
      if (typeof m === 'string') {
        return { clause: m, why_it_matters: '' };
      }
      if (typeof m === 'object' && m !== null && m.clause) {
        return m;
      }
      console.warn(`[Schema] missing_clauses[${i}] has unexpected shape — skipping`);
      return null;
    }).filter(Boolean);
  }

  return { valid: true };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Parses AI JSON output with retry logic and schema validation.
 *
 * On parse or schema failure, asks the AI to fix its own output (up to
 * `retries` times) before throwing.
 *
 * @param {string} rawText        - Raw text output from the AI
 * @param {string} initialProvider - Provider that generated rawText
 * @param {number} retries        - Number of fix attempts before throwing (default 2)
 * @returns {{ data: Object, provider: string }}
 */
export async function parseAIJsonWithRetry(rawText, initialProvider, retries = 2) {
  let attempt      = rawText;
  let lastProvider = initialProvider;

  for (let i = 0; i <= retries; i++) {
    // ── Step 1: Try to parse ─────────────────────────────────────────────────
    let parsed;
    try {
      const cleaned = cleanJsonString(attempt);

      if (!cleaned) {
        throw new Error('Cleaned string is empty — AI may have returned no content');
      }

      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      if (i === retries) {
        throw new Error(
          `AI returned invalid JSON after ${retries + 1} attempt(s).\n` +
          `Last parse error: ${parseErr.message}\n` +
          `Last raw output (first 500 chars): ${String(attempt).slice(0, 500)}`
        );
      }

      console.warn(`[JSON] Syntax parse failed (attempt ${i + 1}/${retries + 1}) — requesting AI fix`);
      console.warn(`[JSON] Error: ${parseErr.message}`);

      const fixPrompt = buildFixPrompt(attempt, parseErr.message);
      const { text, provider } = await callAI(fixPrompt);
      attempt      = text;
      lastProvider = provider;
      continue; // retry
    }

    // ── Step 2: Validate schema ──────────────────────────────────────────────
    const { valid, reason } = validateSchema(parsed);

    if (valid) {
      if (i > 0) {
        console.info(`[JSON] Successfully parsed after ${i} fix attempt(s) via ${lastProvider}`);
      }
      return { data: parsed, provider: lastProvider };
    }

    if (i === retries) {
      throw new Error(
        `AI JSON failed schema validation after ${retries + 1} attempt(s).\n` +
        `Validation error: ${reason}`
      );
    }

    console.warn(`[JSON] Schema validation failed (attempt ${i + 1}/${retries + 1}): ${reason}`);

    const schemaFixPrompt = buildSchemaFixPrompt(attempt, reason);
    const { text, provider } = await callAI(schemaFixPrompt);
    attempt      = text;
    lastProvider = provider;
  }
}

// ─── Fix Prompt Builders ──────────────────────────────────────────────────────

function buildFixPrompt(brokenJson, errorMessage) {
  return `The following text is supposed to be valid JSON but has a syntax error.
Fix it and return ONLY the corrected JSON.
Do not include any explanation, markdown formatting, or code fences.

SYNTAX ERROR: ${errorMessage}

BROKEN JSON:
${brokenJson}`;
}

function buildSchemaFixPrompt(brokenJson, validationError) {
  return `The following JSON was parsed successfully but is missing required fields.
Fix it and return ONLY the corrected JSON.
Do not include any explanation, markdown formatting, or code fences.

VALIDATION ERROR: ${validationError}

The JSON must contain these top-level fields:
- document_type (string)
- summary (string)
- overall_risk (must be exactly: "low", "medium", or "high")
- sections (array, each item must have: heading, plain_english, who_benefits, risk_level, risk_reason)
- key_dates (array, can be empty)
- key_amounts (array, can be empty)
- missing_clauses (array, can be empty — each item must be an object with "clause" and "why_it_matters")

BROKEN JSON:
${brokenJson}`;
}