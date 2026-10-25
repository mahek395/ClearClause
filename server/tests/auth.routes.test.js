import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

// ---- Mocks: no real database, no real rate limiting, no real JWT secrets ----
const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../src/config/db.js', () => ({ default: { query } }));

vi.mock('../src/middleware/rateLimiter.js', () => ({
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
}));

vi.mock('../src/services/tokenHelpers.js', () => ({
  generateAccessToken: () => 'fake-access-token',
  generateRefreshToken: () => ({ raw: 'raw-refresh', hash: 'hashed-refresh' }),
  hashToken: () => 'hashed-refresh',
}));

import authRoutes from '../src/routes/auth.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  return app;
}

const app = makeApp();

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
});

describe('POST /api/auth/register', () => {
  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('returns 409 when the email already exists', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@example.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  it('creates a user, returns 201 and sets the refresh cookie', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })                                     // email not taken
      .mockResolvedValueOnce({ rows: [{ id: 7, email: 'new@example.com' }] }); // insert user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: ' NEW@Example.com ', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBe('fake-access-token');
    expect(res.body.user.email).toBe('new@example.com'); // normalized
    expect(res.headers['set-cookie'].join(';')).toContain('refreshToken=');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 when the password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for an unknown user', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 401 for a wrong password', async () => {
    const hash = bcrypt.hashSync('correct-password', 4);
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'u@example.com', password_hash: hash }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in with the correct password and returns a token', async () => {
    const hash = bcrypt.hashSync('correct-password', 4);
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'u@example.com', password_hash: hash }] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@example.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('fake-access-token');
    expect(res.headers['set-cookie'].join(';')).toContain('refreshToken=');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 when there is no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token');
  });

  it('returns 401 when the refresh token is invalid or expired', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=abc');
    expect(res.status).toBe(401);
  });

  it('returns a new access token for a valid refresh token', async () => {
    query.mockResolvedValueOnce({ rows: [{ user_id: 3, email: 'u@example.com' }] });
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=abc');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('fake-access-token');
    expect(res.body.user).toEqual({ id: 3, email: 'u@example.com' });
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out successfully', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', 'refreshToken=abc');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
});