import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser'; // ← ES module import
import { fileURLToPath } from 'url';
import './src/config/db.js';
import documentRoutes from './src/routes/documents.routes.js';
import analyzeRoutes from './src/routes/analyze.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { startAllWorkers } from './src/workers/index.js';
import jobRoutes from './src/routes/jobs.routes.js';
import { globalLimiter } from "./src/middleware/rateLimiter.js";
import chatRoutes from './src/routes/chat.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use("/api", globalLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/documents', documentRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chat', chatRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ClearClause server is running' });
});

app.use(errorHandler);
startAllWorkers();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});