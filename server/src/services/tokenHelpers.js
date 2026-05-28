// src/services/tokenHelpers.js

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─── Access Token (short-lived JWT) ─────────────────────────────

export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    }
  );
}

// ─── Verify Access Token ────────────────────────────────────────

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ─── Refresh Token ──────────────────────────────────────────────

export function generateRefreshToken() {
  const raw = crypto.randomBytes(64).toString('hex');

  const hash = hashToken(raw);

  return {
    raw,
    hash,
  };
}

// ─── Hash Token ─────────────────────────────────────────────────

export function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}