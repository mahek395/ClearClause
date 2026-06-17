// src/controllers/documents.controller.js
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { enqueueDocument } from '../queues/documentQueue.js'; // ← NEW

// ---------------------------------------------------
// Upload Document
// ---------------------------------------------------

export async function uploadDocument(req, res) {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Upload] Received: ${req.file.originalname}`);

    // ── No more inline OCR here — BullMQ worker handles it ──────────────────
    // We just save the file metadata and enqueue the job.

    const shareToken = uuidv4().replace(/-/g, '').slice(0, 16);
    // Replace the pool.query INSERT and everything after it in uploadDocument:

    const docResult = await pool.query(
      `INSERT INTO documents
     (user_id, share_token, filename, raw_text, page_count,
      file_size, is_scanned, file_path, status)
   VALUES ($1, $2, $3, NULL, NULL, $4, FALSE, $5, 'pending')
   RETURNING id`,
      [
        req.user?.id || null,
        shareToken,
        req.file.originalname,
        req.file.size,
        req.file.path,
      ]
    );

    const documentId = docResult.rows[0].id;

    const job = await enqueueDocument({
      documentId,
      filePath: req.file.path,
      isScanned: false,
    });

    // Save jobId to the existing job_id column
    await pool.query(
      `UPDATE documents SET job_id = $1 WHERE id = $2`,
      [job.id, documentId]
    );

    console.log(`[Queue] Job ${job.id} enqueued for document ${documentId}`);

    return res.status(200).json({
      documentId,
      jobId: job.id,
      shareToken,
      status: 'pending',
      streamUrl: `/api/analyze/stream/${documentId}`,
    });

  } catch (err) {
    console.error('[Upload] Error:', err.message);

    // Clean up uploaded file if DB/queue failed
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

// ---------------------------------------------------
// Get Document by ID
// ---------------------------------------------------

export async function getDocument(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         d.*,
         a.overall_summary,
         a.overall_risk,
         a.missing_clauses,
         a.sections,
         a.key_dates,
         a.key_amounts,
         a.ai_provider
       FROM documents d
       LEFT JOIN analyses a ON a.document_id = d.id
       WHERE d.id = $1 AND (d.user_id IS NULL OR d.user_id = $2)`,
      [id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    return res.json(result.rows[0]);

  } catch (err) {
    console.error('[Get Document]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------
// Get Shared Document
// ---------------------------------------------------

export async function getDocumentByShareToken(req, res) {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT
         d.*,
         a.overall_summary,
         a.overall_risk,
         a.missing_clauses,
         a.sections,
         a.key_dates,
         a.key_amounts,
         a.ai_provider
       FROM documents d
       LEFT JOIN analyses a ON a.document_id = d.id
       WHERE d.share_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shared document not found' });
    }

    return res.json(result.rows[0]);

  } catch (err) {
    console.error('[Get Shared Document]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------
// Get Logged-in User's Documents
// ---------------------------------------------------

export async function getUserDocuments(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         id, share_token, filename, doc_type,
         page_count, file_size, is_scanned, status, created_at
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json(result.rows);

  } catch (err) {
    console.error('[Get User Documents]', err.message);
    return res.status(500).json({ error: 'Failed to fetch user documents' });
  }
}

// ---------------------------------------------------
// Delete Document
// ---------------------------------------------------

export async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT id, file_path FROM documents WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    const filePath = existing.rows[0].file_path;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query(`DELETE FROM analyses  WHERE document_id = $1`, [id]);
    await pool.query(`DELETE FROM documents WHERE id = $1`, [id]);

    return res.status(200).json({ success: true, message: 'Document deleted successfully' });

  } catch (err) {
    console.error('[Delete Document]', err.message);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
}