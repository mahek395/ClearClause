// src/workers/index.js
import { startDocumentWorker } from './documentWorker.js';

export function startAllWorkers() {
  startDocumentWorker();
}