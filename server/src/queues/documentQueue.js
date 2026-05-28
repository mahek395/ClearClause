// src/queues/documentQueue.js
import { Queue } from 'bullmq';
import redisConnection from '../config/redis.js';

export const documentQueue = new Queue('document-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type:  'exponential',
      delay: 3000,
    },
    removeOnComplete: { age: 3600 * 24, count: 100 },
    removeOnFail:     { age: 3600 * 24 * 7 },
  },
});

/**
 * Enqueues a document for OCR / text extraction.
 * @param {{ documentId: string, filePath: string, isScanned: boolean }} payload
 * @returns {Promise<Job>}
 */
export async function enqueueDocument({ documentId, filePath, isScanned }) {
  const job = await documentQueue.add(
    'process-document',
    { documentId, filePath, isScanned },
    { jobId: `doc-${documentId}` } // deterministic — prevents duplicate jobs on re-upload
  );
  console.log(`[Queue] Job ${job.id} added for document ${documentId}`);
  return job;
}

/**
 * Returns current status of a job by ID.
 * @param {string} jobId
 */
export async function getJobStatus(jobId) {
  const job = await documentQueue.getJob(jobId);
  if (!job) return null;

  const state      = await job.getState();
  const progress   = job.progress  || 0;
  const failReason = job.failedReason || null;

  return { jobId: job.id, state, progress, failReason };
}