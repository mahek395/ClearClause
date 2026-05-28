// src/controllers/analyze.controller.js
import jwt  from 'jsonwebtoken';
import pool from '../config/db.js';
import { analyzeDocumentStreaming } from '../services/analysis.service.js';

function sendEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function streamAnalysis(req, res) {
  const { documentId } = req.params;

  // ── Auth: JWT via query param (SSE can't send custom headers) ────────────
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // ── SSE headers ───────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // ── Fetch document ────────────────────────────────────────────────────
    const docResult = await pool.query(
      `SELECT raw_text, status, user_id FROM documents WHERE id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      sendEvent(res, { type: 'error', message: 'Document not found' });
      return res.end();
    }

    const document = docResult.rows[0];

    if (document.user_id !== user.id) {
      sendEvent(res, { type: 'error', message: 'Access denied' });
      return res.end();
    }

    const { raw_text, status } = document;

    // ── BullMQ worker still running ───────────────────────────────────────
    if (status === 'pending' || status === 'processing') {
      sendEvent(res, {
        type:    'waiting',
        message: 'Your document is still being processed. Please wait a moment and try again.',
      });
      return res.end();
    }

    // ── Worker failed ─────────────────────────────────────────────────────
    if (status === 'failed') {
      sendEvent(res, {
        type:    'error',
        message: 'Document processing failed. Please re-upload the file.',
      });
      return res.end();
    }

    // ── Serve cached analysis ─────────────────────────────────────────────
    if (status === 'done') {
      console.log(`[Stream] Serving cached analysis for: ${documentId}`);

      const cached = await pool.query(
        `SELECT * FROM analyses WHERE document_id = $1`,
        [documentId]
      );

      if (cached.rows.length > 0) {
        const a = cached.rows[0];
        sendEvent(res, { type: 'doc_type',       value: a.doc_type });
        sendEvent(res, { type: 'provider',        value: a.ai_provider });
        sendEvent(res, { type: 'summary',         chunk: a.overall_summary }); // ✅ FIXED: using overall_summary
        sendEvent(res, { type: 'overall_risk',    value: a.overall_risk });
        for (const section of (a.sections || [])) {
          sendEvent(res, { type: 'section', data: section });
        }
        sendEvent(res, { type: 'missing_clauses', data: a.missing_clauses || [] });
        sendEvent(res, { type: 'key_dates',       data: a.key_dates       || [] });
        sendEvent(res, { type: 'key_amounts',     data: a.key_amounts     || [] });
        sendEvent(res, { type: 'complete' });
        return res.end();
      }
    }

    // ── status === 'ready' (or 'done' with no cached row) — run AI ────────
    if (!raw_text || raw_text.trim().length === 0) {
      sendEvent(res, { type: 'error', message: 'Document has no extractable text.' });
      return res.end();
    }

    console.log(`[Stream] Running AI analysis for: ${documentId}`);

    await pool.query(
      `UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [documentId]
    );

    const analysis = await analyzeDocumentStreaming(raw_text, {
      onChunk:    () => res.write(': ping\n\n'),
      onProvider: (p) => console.log(`[Stream] AI provider: ${p}`),
    });

    sendEvent(res, { type: 'doc_type',     value: analysis.doc_type });
    sendEvent(res, { type: 'provider',     value: analysis.ai_provider });
    sendEvent(res, { type: 'summary',      chunk: analysis.summary }); // ✅ FIXED: sending analysis.summary from AI
    sendEvent(res, { type: 'overall_risk', value: analysis.overall_risk });
    for (const section of (analysis.sections || [])) {
      sendEvent(res, { type: 'section', data: section });
    }
    sendEvent(res, { type: 'missing_clauses', data: analysis.missing_clauses || [] });
    sendEvent(res, { type: 'key_dates',       data: analysis.key_dates       || [] });
    sendEvent(res, { type: 'key_amounts',     data: analysis.key_amounts     || [] });

    // ── Persist analysis ──────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO analyses
         (document_id, overall_summary, doc_type, overall_risk,
          missing_clauses, sections, key_dates, key_amounts, ai_provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (document_id) DO UPDATE
         SET overall_summary  = EXCLUDED.overall_summary,     -- ✅ FIXED: using overall_summary column
             doc_type        = EXCLUDED.doc_type,
             overall_risk    = EXCLUDED.overall_risk,
             missing_clauses = EXCLUDED.missing_clauses,
             sections        = EXCLUDED.sections,
             key_dates       = EXCLUDED.key_dates,
             key_amounts     = EXCLUDED.key_amounts,
             ai_provider     = EXCLUDED.ai_provider`,
      [
        documentId,
        analysis.summary,          // ✅ AI returns 'summary', we store it in 'overall_summary' column
        analysis.doc_type,
        analysis.overall_risk,
        JSON.stringify(analysis.missing_clauses || []),
        JSON.stringify(analysis.sections        || []),
        JSON.stringify(analysis.key_dates       || []),
        JSON.stringify(analysis.key_amounts     || []),
        analysis.ai_provider,
      ]
    );

    await pool.query(
      `UPDATE documents SET status = 'done', doc_type = $1, updated_at = NOW() WHERE id = $2`,
      [analysis.doc_type, documentId]
    );

    sendEvent(res, { type: 'complete' });
    res.end();
  } catch (err) {
    console.error('[Stream] Error:', err.message);

    // Reset status so user can retry without re-uploading
    await pool.query(
      `UPDATE documents SET status = 'ready', updated_at = NOW() WHERE id = $1`,
      [documentId]
    ).catch(() => {});

    sendEvent(res, { type: 'error', message: err.message });
    res.end();
  }
}