// src/workers/documentWorker.js
import { Worker }    from 'bullmq';
import fs            from 'fs';
import path          from 'path';
import Tesseract     from 'tesseract.js';
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import redisConnection from '../config/redis.js';
import pool            from '../config/db.js';
import { enqueueEmbedding } from '../queues/documentQueue.js';

// ── Digital PDF text extraction ───────────────────────────────────────────────

async function extractTextFromPDF(filePath) {
  const data     = new Uint8Array(fs.readFileSync(filePath));
  const pdfDoc   = await pdfjsLib.getDocument({ data }).promise;
  const numPages = pdfDoc.numPages;
  const parts    = [];

  for (let i = 1; i <= numPages; i++) {
    const page    = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map(item => item.str).join(' '));
  }

  return { text: parts.join('\n\n'), pageCount: numPages };
}

// ── Scanned PDF via Tesseract ─────────────────────────────────────────────────

async function extractTextWithOCR(filePath, job) {
  await job.updateProgress(10);

  const result = await Tesseract.recognize(filePath, 'eng+hin', {
    logger: async (m) => {
      if (m.status === 'recognizing text') {
        await job.updateProgress(Math.round(10 + m.progress * 70));
      }
    },
  });

  return { text: result.data.text, pageCount: 1 };
}

// ── Core job processor ────────────────────────────────────────────────────────

async function processDocument(job) {
  const { documentId, filePath, isScanned } = job.data;
  console.log(`[Worker] Job ${job.id} started — document ${documentId}`);

  // Mark processing
  await pool.query(
    `UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [documentId]
  );
  await job.updateProgress(5);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let text, pageCount;

  if (isScanned) {
    console.log(`[Worker] OCR: ${path.basename(filePath)}`);
    ({ text, pageCount } = await extractTextWithOCR(filePath, job));
  } else {
    console.log(`[Worker] PDF extract: ${path.basename(filePath)}`);
    ({ text, pageCount } = await extractTextFromPDF(filePath));

    // Fallback: if PDF has no selectable text, run OCR
    if (!text || text.trim().length < 100) {
      console.log(`[Worker] Falling back to OCR`);
      ({ text, pageCount } = await extractTextWithOCR(filePath, job));
    }
  }

  await job.updateProgress(85);

  // Save raw_text, set status → 'ready' (SSE handler checks for this)
  await pool.query(
    `UPDATE documents
     SET raw_text   = $1,
         page_count = $2,
         is_scanned = $3,
         status     = 'ready',
         updated_at = NOW()
     WHERE id = $4`,
    [text, pageCount, isScanned, documentId]
  );
await enqueueEmbedding(documentId);
  await job.updateProgress(100);
  console.log(`[Worker] ✅ Job ${job.id} done — document ${documentId} ready`);
  return { documentId, pageCount, textLength: text.length };
}

// ── Worker startup ────────────────────────────────────────────────────────────

export function startDocumentWorker() {
  const worker = new Worker('document-processing', processDocument, {
    connection:  redisConnection,
    concurrency: 3,
  });

  worker.on('completed', (job, result) =>
    console.log(`[Worker] ✅ ${job.id}:`, result)
  );

  worker.on('failed', async (job, err) => {
    console.error(`[Worker] ❌ ${job.id}:`, err.message);
    if (job?.data?.documentId) {
      await pool.query(
        `UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [job.data.documentId]
      ).catch(() => {});
    }
  });

  console.log('✅ Document worker started (concurrency: 3)');
  return worker;
}