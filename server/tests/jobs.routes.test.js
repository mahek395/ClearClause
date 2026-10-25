import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---- Mocks: no Redis/BullMQ, no real auth, no rate limiting ----
const { getJobStatus } = vi.hoisted(() => ({ getJobStatus: vi.fn() }));

vi.mock('../src/queues/documentQueue.js', () => ({ getJobStatus }));

vi.mock('../src/middleware/auth.middleware.js', () => ({
  verifyTokenOptional: (req, res, next) => next(),
}));

vi.mock('../src/middleware/rateLimiter.js', () => ({
  jobStatusLimiter: (req, res, next) => next(),
}));

import jobRoutes from '../src/routes/jobs.routes.js';

const app = express();
app.use(express.json());
app.use('/api/jobs', jobRoutes);

beforeEach(() => {
  getJobStatus.mockReset();
});

describe('GET /api/jobs/:jobId', () => {
  it('returns 404 when the job does not exist', async () => {
    getJobStatus.mockResolvedValue(null);
    const res = await request(app).get('/api/jobs/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('returns the job status and progress', async () => {
    getJobStatus.mockResolvedValue({ jobId: '12', state: 'active', progress: 40, failReason: null });
    const res = await request(app).get('/api/jobs/12');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('active');
    expect(res.body.progress).toBe(40);
  });

  it('returns 500 when the queue throws', async () => {
    getJobStatus.mockRejectedValue(new Error('redis down'));
    const res = await request(app).get('/api/jobs/12');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to get job status');
  });
});