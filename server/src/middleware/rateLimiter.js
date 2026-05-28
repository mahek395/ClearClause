import rateLimit from "express-rate-limit";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds a standard JSON 429 response.
 * Includes a Retry-After header so the client knows when to try again.
 */
const handler = (message) => (req, res) => {
  res.status(429).json({ error: message });
};

// ─── 1. Global limiter ───────────────────────────────────────────────────────
// Applied to every /api/* route as a baseline.
// 100 requests per 15 minutes per IP — generous enough for normal use,
// tight enough to stop bots and scrapers.

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,  // Sends RateLimit-* headers (RFC 6585)
  legacyHeaders: false,   // Disables X-RateLimit-* headers (old format)
  handler: handler("Too many requests. Please try again in 15 minutes."),
});

// ─── 2. Login limiter ────────────────────────────────────────────────────────
// POST /api/auth/login
// Prevents brute-force password attacks.
// 10 attempts per 15 minutes per IP — a real user will never hit this.

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler(
    "Too many login attempts. Please wait 15 minutes before trying again."
  ),
});

// ─── 3. Register limiter ─────────────────────────────────────────────────────
// POST /api/auth/register
// Prevents spam account creation.
// 5 registrations per hour per IP — a real user registers once.

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler(
    "Too many accounts created from this IP. Please try again in an hour."
  ),
});

// ─── 4. Upload limiter ───────────────────────────────────────────────────────
// POST /api/documents/upload
// Each upload triggers: Multer (disk write) + DB insert + BullMQ job.
// 5 uploads per minute is more than enough for legitimate use.
// Prevents someone from flooding the job queue and choking the worker.

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler(
    "Upload limit reached. You can upload up to 5 documents per minute."
  ),
});

// ─── 5. Analyze limiter ──────────────────────────────────────────────────────
// GET /api/analyze/stream/:documentId
// Each analysis call hits Gemini or Groq — real API costs.
// 20 analyses per hour per IP is generous for a real user.
// Prevents someone from draining your entire daily Gemini quota (250 req/day).

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler(
    "Analysis limit reached. You can analyze up to 20 documents per hour."
  ),
});
// ─── 6. Job status limiter ───────────────────────────────────────────────────
// GET /api/jobs/:jobId
// Frontend polls this every 2 seconds during document processing.
// 120 req/min = one request every 0.5s — covers multiple concurrent uploads
// while still blocking tight-loop abuse.

export const jobStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("Too many job status requests. Please slow down."),
});