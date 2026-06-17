import express from 'express';
import { chatWithDocument } from '../controllers/chat.controller.js';
import { verifyTokenOptional } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/:documentId', verifyTokenOptional, chatWithDocument);
router.get('/test', (req, res) => {
  res.json({ ok: true });
});
export default router;