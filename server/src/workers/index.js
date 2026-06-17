// src/workers/index.js
import { startDocumentWorker } from './documentWorker.js';
import { startEmbeddingWorker } from './embeddingWorker.js';

export function startAllWorkers() {
  startDocumentWorker();
  startEmbeddingWorker();
}