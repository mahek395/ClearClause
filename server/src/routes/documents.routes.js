import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateAnalysisPDF } from '../services/pdfExport.service.js';
import { upload } from '../middleware/upload.middleware.js';
import { enqueueDocument } from '../queues/documentQueue.js';
import {
  uploadDocument,
  getDocument,
  getDocumentByShareToken,
  getUserDocuments,
  deleteDocument,
} from '../controllers/documents.controller.js';
import { uploadLimiter } from "../middleware/rateLimiter.js";

import { verifyToken, verifyTokenOptional } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';  // ← default import, matches your controller

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------
// Upload document
// ---------------------------------------------------

router.post(
  '/upload',
  uploadLimiter,
  verifyTokenOptional,
  upload.single('file'),
  uploadDocument
);

// ---------------------------------------------------
// Public shared document
// ---------------------------------------------------

router.get(
  '/share/:token',
  getDocumentByShareToken
);

// ---------------------------------------------------
// Serve original PDF file (JWT-protected)
// ---------------------------------------------------

router.get(
  '/:id/file',
  verifyTokenOptional,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      const result = await pool.query(
        'SELECT file_path FROM documents WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const filePath = path.resolve(result.rows[0].file_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      fs.createReadStream(filePath).pipe(res);

    } catch (err) {
      console.error('[PDF Serve Error]', err);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }
);

// ---------------------------------------------------
// Logged-in user's documents
// ---------------------------------------------------

router.get(
  '/user/all',
  verifyToken,
  getUserDocuments
);

// ---------------------------------------------------
// Get document by ID
// ---------------------------------------------------

router.get(
  '/:id',
  verifyTokenOptional,
  getDocument
);

// ---------------------------------------------------
// Delete document
// ---------------------------------------------------

router.delete(
  '/:id',
  verifyToken,
  deleteDocument
);
router.get('/:documentId/export', verifyTokenOptional, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id || null;
 
    // ── Fetch document (ownership enforced or anonymous) ────────────────────
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [documentId, userId]
    );
 
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
 
    // ── Fetch most recent analysis ───────────────────────────────────────────
    const analysisResult = await pool.query(
      `SELECT * FROM analyses
       WHERE document_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [documentId]
    );
 
    if (analysisResult.rows.length === 0) {
      return res.status(404).json({ error: 'No analysis found for this document. Run analysis first.' });
    }
 
    const docData  = docResult.rows[0];
    const analysis = analysisResult.rows[0];
 
    // ── Parse JSON fields stored as strings in Postgres ──────────────────────
    // (skip this block if your DB driver already returns parsed objects)
    const jsonFields = ['sections', 'missing_clauses', 'key_dates', 'key_amounts'];
    jsonFields.forEach(field => {
      if (typeof analysis[field] === 'string') {
        try {
          analysis[field] = JSON.parse(analysis[field]);
        } catch {
          analysis[field] = [];
        }
      }
      if (!Array.isArray(analysis[field])) {
        analysis[field] = [];
      }
    });
 
    // ── Stream PDF ───────────────────────────────────────────────────────────
    generateAnalysisPDF(docData, analysis, res);
 
  } catch (err) {
    console.error('[PDF Export] Unexpected error:', err);
    // Only send JSON error if headers haven't been sent (PDF stream not started)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF export' });
    }
  }
});
export default router;