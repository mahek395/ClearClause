import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { loginLimiter, registerLimiter } from "../middleware/rateLimiter.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../services/tokenHelpers.js';

const router = express.Router();

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7',
  10
);

function setRefreshCookie(res, rawToken) {
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

async function saveRefreshToken(userId, hash) {
  const expiresAt = new Date(
    Date.now() +
    REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  // Keep only one active refresh token per user
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1',
    [userId]
  );

  await pool.query(
    `
      INSERT INTO refresh_tokens (
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
    `,
    [userId, hash, expiresAt]
  );
}

// ======================================================
// REGISTER
// ======================================================

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
        INSERT INTO users (
          email,
          password_hash
        )
        VALUES ($1, $2)
        RETURNING id, email
      `,
      [normalizedEmail, passwordHash]
    );

    const user = result.rows[0];

    // Generate access token
    const accessToken = generateAccessToken(user);

    // Generate refresh token
    const { raw, hash } = generateRefreshToken();

    await saveRefreshToken(user.id, hash);

    setRefreshCookie(res, raw);

    return res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    });

  } catch (err) {
    console.error('[Auth] Register error:', err);

    return res.status(500).json({
      error: 'Registration failed',
    });
  }
});

// ======================================================
// LOGIN
// ======================================================

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      `
        SELECT
          id,
          email,
          password_hash
        FROM users
        WHERE email = $1
      `,
      [normalizedEmail]
    );

    const user = result.rows[0];

    const passwordMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(
        password,
        '$2b$12$invalidhashtopreventtimingattack00000000000'
      );

    if (!user || !passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Access token
    const accessToken = generateAccessToken(user);

    // Refresh token
    const { raw, hash } = generateRefreshToken();

    await saveRefreshToken(user.id, hash);

    setRefreshCookie(res, raw);

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    });

  } catch (err) {
    console.error('[Auth] Login error:', err);

    return res.status(500).json({
      error: 'Login failed',
    });
  }
});

// ======================================================
// REFRESH
// ======================================================

router.post('/refresh', async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({
        error: 'No refresh token',
      });
    }

    const tokenHash = hashToken(rawToken);

    const result = await pool.query(
      `
        SELECT
          rt.*,
          u.email
        FROM refresh_tokens rt
        JOIN users u
          ON u.id = rt.user_id
        WHERE rt.token_hash = $1
          AND rt.revoked = FALSE
          AND rt.expires_at > NOW()
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      clearRefreshCookie(res);

      return res.status(401).json({
        error: 'Invalid or expired refresh token',
      });
    }

    const record = result.rows[0];

    const user = {
      id: record.user_id,
      email: record.email,
    };

    // IMPORTANT:
    // Do NOT rotate refresh token here.
    // This prevents React StrictMode double-refresh issues.

    const accessToken = generateAccessToken(user);

    return res.json({
      accessToken,
      user,
    });

  } catch (err) {
    console.error('[Auth] Refresh error:', err);

    return res.status(500).json({
      error: 'Token refresh failed',
    });
  }
});

// ======================================================
// LOGOUT
// ======================================================

router.post('/logout', async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;

    if (rawToken) {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE token_hash = $1',
        [hashToken(rawToken)]
      );
    }

    clearRefreshCookie(res);

    return res.json({
      message: 'Logged out successfully',
    });

  } catch (err) {
    console.error('[Auth] Logout error:', err);

    return res.status(500).json({
      error: 'Logout failed',
    });
  }
});

export default router;