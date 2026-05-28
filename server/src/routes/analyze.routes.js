import express from 'express';
import { streamAnalysis } from '../controllers/analyze.controller.js';
import { analyzeLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.get('/stream/:documentId', analyzeLimiter, streamAnalysis);

export default router;