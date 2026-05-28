// frontend/src/utils/axiosInstance.js
// A pre-configured axios instance that:
//   1. Attaches the in-memory access token to every request
//   2. On 401 → silently calls /auth/refresh → retries the original request
//   3. On refresh failure → clears auth state and redirects to /login
//
// Replace ALL direct `axios` calls and `fetch` calls (for authenticated routes)
// in your app with this instance.
//
// Usage:
//   import api from '../utils/axiosInstance';
//   const res = await api.get('/documents');
//   const res = await api.post('/documents/upload', formData);

import axios from 'axios';
import { tokenStore } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true, // ← CRITICAL: sends the httpOnly refreshToken cookie automatically
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches the current in-memory access token before every request.

api.interceptors.request.use(
  (config) => {
    const token = tokenStore.get();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ────────────────────────────────────────────────────
// Catches 401s, attempts a silent token refresh, then retries the failed request.

let isRefreshing    = false;
let refreshQueue    = []; // queued requests waiting for the new token

function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else       resolve(token);
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response, // pass through successful responses

  async (error) => {
    const originalRequest = error.config;

    // Only handle 401s, and don't retry the refresh endpoint itself
    const is401         = error.response?.status === 401;
    const isRefreshCall = originalRequest.url?.includes('/auth/refresh');
    const alreadyRetried = originalRequest._retry;

    if (!is401 || isRefreshCall || alreadyRetried) {
      return Promise.reject(error);
    }

    originalRequest._retry = true; // mark so we don't loop

    // ── If a refresh is already in flight, queue this request ────────────────
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    // ── Start the refresh ─────────────────────────────────────────────────────
    isRefreshing = true;

    try {
      // The httpOnly cookie is sent automatically (withCredentials: true)
      const { data } = await api.post('/auth/refresh');

      const newToken = data.accessToken;
      tokenStore.set(newToken);

      // Replay all queued requests with the new token
      processQueue(null, newToken);

      // Retry the original failed request
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return api(originalRequest);

    } catch (refreshError) {
      // Refresh failed — session is truly expired
      processQueue(refreshError, null);
      tokenStore.clear();

      // Redirect to login (works outside React components)
      window.location.href = '/login';
      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  }
);

export default api;