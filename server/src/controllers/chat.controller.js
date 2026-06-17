import { searchSimilarChunks, getOpeningChunk } from '../services/embedding.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function chatWithDocument(req, res) {
  const { documentId } = req.params;
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  // Verify document belongs to user
  const { rows } = await pool.query(
    'SELECT id, status FROM documents WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
    [documentId, req.user?.id || null]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
  if (rows[0].status !== 'done' && rows[0].status !== 'ready') {
    return res.status(400).json({ error: 'Document analysis not complete yet' });
  }

  // Find relevant chunks
  const chunks = await searchSimilarChunks(documentId, message, pool, 5);

  if (chunks.length === 0) {
    return res.status(400).json({ error: 'No embeddings found — document may still be indexing' });
  }

  // Always include the opening chunk (party names, title, recitals) if not already present
  const opening = await getOpeningChunk(documentId, pool);
  if (opening && !chunks.some(c => c.chunk_index === 0)) {
    chunks.unshift(opening);
  }

  const context = chunks.map((c, i) => `[Chunk ${i + 1}]:\n${c.chunk_text}`).join('\n\n');

  const systemPrompt = `You are ClearClause AI, a legal document assistant that helps everyday people understand legal documents without needing a lawyer.

The user has uploaded a legal document and is asking questions about it. You have been given the most relevant excerpts from that document.

ANSWER RULES:
- Answer ONLY from the provided document excerpts. Never use outside knowledge to fill gaps.
- If the answer is not in the excerpts, say exactly: "I couldn't find that in the provided excerpts. Try asking in a different way, or this detail may not be in the document."
- Never make up clause numbers, dates, amounts, or names that aren't explicitly in the excerpts.

LANGUAGE RULES:
- Write for someone with no legal background. If you must use a legal term, immediately explain it in plain English in parentheses.
- Be direct and confident. Avoid phrases like "it appears", "it seems", "you may want to" unless genuinely uncertain.
- Keep answers concise. Use numbered lists for multiple obligations/rights. Use short paragraphs for explanations.

SPECIFICITY RULES:
- Always pull exact figures from the document — timeframes, amounts, percentages, deadlines, notice periods.
- Always name the actual parties (e.g. "3M Company" not just "you" or "the receiving party").
- Always reference the relevant section if mentioned in the excerpt (e.g. "Section 3.1 says...").

RISK FLAGGING RULES:
- If something in the answer is unusually risky or one-sided, flag it with ⚠️ and explain why in plain English.
- Common things to flag across document types:
  * Automatic renewal clauses with short cancellation windows
  * Unlimited liability or no liability cap
  * Unilateral right to change terms
  * Very long non-compete or non-solicitation periods
  * Obligations that survive termination indefinitely
  * Jurisdiction in a distant or inconvenient location
  * Waiver of jury trial
  * Landlord right to enter without notice
  * Assignment of intellectual property beyond the scope of work
  * Personal guarantees on business contracts

DOCUMENT TYPE AWARENESS:
Adapt your tone and focus based on what type of document this appears to be:
- NDA / Confidentiality Agreement → focus on what can/cannot be shared, duration, what counts as confidential
- Rental / Lease Agreement → focus on rent, deposits, maintenance responsibilities, termination, entry rights
- Employment / Offer Letter → focus on compensation, termination conditions, IP assignment, non-compete, benefits
- Service / Freelance Contract → focus on payment terms, deliverables, IP ownership, termination, liability
- Loan Agreement → focus on interest rate, repayment schedule, default conditions, penalties
- Terms of Service → focus on what rights the user gives up, data usage, arbitration clauses
- Any other document → focus on obligations, rights, amounts, deadlines, and exit conditions

CONVERSATION RULES:
- If the user asks a follow-up question like "can you explain that more" or "what does that mean", refer back to your previous answer and expand on it.
- If the user asks something outside the document (e.g. "is this legal?", "what should I do?"), say: "That's a legal judgment I can't make — I can only tell you what this document says. For advice on what to do, consult a lawyer."

ENDING RULES:
- Never end with a long disclaimer paragraph. One short sentence max if needed: "This is a document summary, not legal advice."
- Never say "I hope this helps" or "feel free to ask more questions" — just answer and stop.

Document excerpts:
${context}`;

  // Build conversation history for the AI
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log(`[Chat] Processing query for document: ${documentId} — "${message.slice(0, 50)}..."`);

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Try Gemini first
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    });

    const result = await chat.sendMessageStream(message);

    send('provider', { provider: 'gemini' });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) send('chunk', { text });
    }

    send('complete', {});
    console.log(`[Chat] ✅ Response complete for document: ${documentId}`);
    res.end();

  } catch (geminiErr) {
    console.warn('[Chat] Gemini failed, falling back to Groq:', geminiErr.message);

    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      send('provider', { provider: 'groq' });

      const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) send('chunk', { text });
      }

      send('complete', {});
      res.end();

    } catch (groqErr) {
      console.error('[Chat] Groq also failed:', groqErr.message);
      send('error', { message: 'AI provider failed' });
      res.end();
    }
  }
}