// src/routes/jobs.routes.js
import express          from 'express';
import {verifyToken }     from '../middleware/auth.middleware.js';
import { getJobStatus } from '../queues/documentQueue.js';
import { jobStatusLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// GET /api/jobs/:jobId
// Frontend polls this after upload to track OCR progress.
// Response: { jobId, state: 'waiting'|'active'|'completed'|'failed', progress: 0–100, failReason }

router.get('/:jobId', jobStatusLimiter, verifyToken, async (req, res) => {
  try {
    const status = await getJobStatus(req.params.jobId);
    if (!status) return res.status(404).json({ error: 'Job not found' });
    return res.json(status);
  } catch (err) {
    console.error('[Jobs] Error:', err);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

export default router;