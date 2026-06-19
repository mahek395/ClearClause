import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { enqueueDocument } from '../queues/documentQueue.js';
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

// ── Helper: upload buffer to Cloudinary ──────────────────────────────────────

function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',        // PDFs are 'raw', not 'image'
        folder: 'clearclause',
        public_id: `${Date.now()}-${uuidv4()}`,
        format: 'pdf',
        use_filename: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

// ---------------------------------------------------
// Upload Document
// ---------------------------------------------------

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Upload] Received: ${req.file.originalname}`);

    // ── Upload to Cloudinary ─────────────────────────────────────────────────
    let cloudinaryUrl = null;
    let cloudinaryPublicId = null;

    try {
      const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      cloudinaryUrl = result.secure_url;
      cloudinaryPublicId = result.public_id;
      console.log(`[Upload] Cloudinary upload success: ${cloudinaryUrl}`);
    } catch (cloudErr) {
      console.error('[Upload] Cloudinary upload failed:', cloudErr.message);
      // Don't fail the whole upload if Cloudinary fails — analysis still works
      // file_url will just be null and View PDF button will be disabled
    }

    // ── Write buffer to temp file for BullMQ worker (needs a file path) ──────
    const tmpPath = `/tmp/${Date.now()}-${uuidv4()}.pdf`;
    fs.writeFileSync(tmpPath, req.file.buffer);

    const shareToken = uuidv4().replace(/-/g, '').slice(0, 16);

    const docResult = await pool.query(
      `INSERT INTO documents
         (user_id, share_token, filename, raw_text, page_count,
          file_size, is_scanned, file_path, file_url, status)
       VALUES ($1, $2, $3, NULL, NULL, $4, FALSE, $5, $6, 'pending')
       RETURNING id`,
      [
        req.user?.id || null,
        shareToken,
        req.file.originalname,
        req.file.size,
        tmpPath,           // temp path for worker to read
        cloudinaryUrl,     // persistent Cloudinary URL
      ]
    );

    const documentId = docResult.rows[0].id;

    const job = await enqueueDocument({
      documentId,
      filePath: tmpPath,
      isScanned: false,
    });

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
       WHERE d.id = $1 AND d.user_id = $2`,
      [id, req.user.id]
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
      `SELECT id, file_path, file_url FROM documents WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    const { file_path, file_url } = existing.rows[0];

    // ── Delete from Cloudinary if URL exists ─────────────────────────────────
    if (file_url) {
      try {
        // Extract public_id from Cloudinary URL
        // URL format: https://res.cloudinary.com/<cloud>/raw/upload/v123/<public_id>.pdf
        const urlParts = file_url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1) {
          // Everything after 'upload/v{version}/' is the public_id (with extension)
          const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // remove extension
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
          console.log(`[Delete] Cloudinary file deleted: ${publicId}`);
        }
      } catch (cloudErr) {
        console.error('[Delete] Cloudinary delete failed (non-critical):', cloudErr.message);
        // Don't fail the delete if Cloudinary cleanup fails
      }
    }

    // ── Delete temp file from disk if it still exists ─────────────────────────
    if (file_path && fs.existsSync(file_path)) {
      fs.unlinkSync(file_path);
    }

    await pool.query(`DELETE FROM analyses  WHERE document_id = $1`, [id]);
    await pool.query(`DELETE FROM documents WHERE id = $1`, [id]);

    return res.status(200).json({ success: true, message: 'Document deleted successfully' });

  } catch (err) {
    console.error('[Delete Document]', err.message);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
}