import cohere from 'cohere-ai';
import pkg from 'pg';
const { Pool } = pkg;

const co = new cohere.CohereClient({ token: process.env.COHERE_API_KEY });

const SEPARATORS = [
  /\n(?=\d+\.\s)/,       // before numbered clauses — lookahead, doesn't consume the number
  /\n(?=[a-z]\)\s)/i,    // before lettered sub-clauses a) b) c)
  /\n\n/,                // paragraph breaks
  /\n/,                  // single line breaks
  /(?<=[.!?])\s+/,       // sentence boundaries
];

export function chunkText(text, maxChars = 1800) {
  const chunks = [];

  function split(segment, separatorIndex) {
    if (segment.trim().length === 0) return;

    if (segment.length <= maxChars) {
      if (segment.trim().length > 50) {
        chunks.push({ index: chunks.length, text: segment.trim() });
      }
      return;
    }

    if (separatorIndex >= SEPARATORS.length) {
      for (let i = 0; i < segment.length; i += maxChars) {
        const slice = segment.slice(i, i + maxChars).trim();
        if (slice.length > 50) chunks.push({ index: chunks.length, text: slice });
      }
      return;
    }

    const sep = SEPARATORS[separatorIndex];
    const parts = segment.split(sep).filter(p => p.trim().length > 0);

    if (parts.length <= 1) {
      split(segment, separatorIndex + 1);
      return;
    }

    if (separatorIndex === 0) {
      for (const part of parts) {
        split(part, separatorIndex + 1);
      }
      return;
    }

    let current = '';
    for (const part of parts) {
      const candidate = current ? current + '\n' + part : part;
      if (candidate.length > maxChars) {
        if (current.trim().length > 50) split(current.trim(), separatorIndex + 1);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current.trim().length > 50) split(current.trim(), separatorIndex + 1);
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  split(normalized, 0);

  return chunks;
}

// Embed chunks via Cohere and store in DB
export async function embedAndStore(documentId, rawText, pool) {
  const chunks = chunkText(rawText);

  if (chunks.length === 0) throw new Error('No chunks generated from text');

  // Delete any existing embeddings for this document (re-run safe)
  await pool.query('DELETE FROM embeddings WHERE document_id = $1', [documentId]);

  // Cohere allows max 96 texts per request — batch if needed
  const BATCH_SIZE = 96;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await co.embed({
      texts: batch.map(c => c.text),
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });

    const embeddings = response.embeddings;

    // Insert all chunks in this batch
    for (let j = 0; j < batch.length; j++) {
      await pool.query(
        `INSERT INTO embeddings (document_id, chunk_index, chunk_text, embedding)
         VALUES ($1, $2, $3, $4)`,
        [
          documentId,
          batch[j].index,
          batch[j].text,
          JSON.stringify(embeddings[j]),
        ]
      );
    }
  }

  return chunks.length;
}

// Embed a user query and find top-k similar chunks
export async function searchSimilarChunks(documentId, query, pool, topK = 5) {
  const response = await co.embed({
    texts: [query],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  const queryEmbedding = JSON.stringify(response.embeddings[0]);

  const result = await pool.query(
    `SELECT chunk_text, chunk_index,
            1 - (embedding <=> $1::vector) AS similarity
     FROM embeddings
     WHERE document_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [queryEmbedding, documentId, topK]
  );

  return result.rows;
}

// Always fetch chunk 0 (document opening — contains party names, title, recitals)
export async function getOpeningChunk(documentId, pool) {
  const result = await pool.query(
    `SELECT chunk_text, chunk_index FROM embeddings
     WHERE document_id = $1 AND chunk_index = 0`,
    [documentId]
  );
  return result.rows[0] || null;
}