// client/src/services/api.js
// Thin wrapper around axiosInstance that exposes named helper functions.
// The auth interceptor (token attach + silent refresh) lives in axiosInstance.js.

import api from '../utils/axiosInstance';

// ---------------------------------------------------
// Upload a PDF document
// ---------------------------------------------------

export const uploadDocument = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
};

// ---------------------------------------------------
// Get document + analysis by ID
// ---------------------------------------------------

export const getDocument = (documentId) =>
  api.get(`/documents/${documentId}`);

// ---------------------------------------------------
// Get shared document (no auth needed)
// ---------------------------------------------------

export const getSharedDocument = (shareToken) =>
  api.get(`/documents/share/${shareToken}`);

// ---------------------------------------------------
// Poll async job status
// ---------------------------------------------------

export const getJobStatus = (jobId) =>
  api.get(`/documents/job/${jobId}`);

export default api;