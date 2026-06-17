import { Worker } from 'bullmq';
import  redisConnection  from '../config/redis.js';
import { embedAndStore } from '../services/embedding.service.js';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function startEmbeddingWorker() {
  const worker = new Worker(
    'embedding-processing',
    async (job) => {
      const { documentId } = job.data;

      console.log(`[EmbeddingWorker] Starting embedding for document: ${documentId}`);

      // Fetch raw_text from DB
      const { rows } = await pool.query(
        'SELECT raw_text FROM documents WHERE id = $1',
        [documentId]
      );

      if (!rows[0] || !rows[0].raw_text) {
        throw new Error(`No raw_text found for document ${documentId}`);
      }

      await job.updateProgress(10);

      const chunkCount = await embedAndStore(documentId, rows[0].raw_text, pool);

      await job.updateProgress(100);

      console.log(`[EmbeddingWorker] Done — ${chunkCount} chunks embedded for ${documentId}`);

      return { chunkCount };
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[EmbeddingWorker] Job ${job.id} failed:`, err.message);
  });

  console.log('[EmbeddingWorker] Worker started');
  return worker;
}