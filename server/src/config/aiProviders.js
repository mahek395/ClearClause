import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// ── Initialize both clients ──────────────────────────────────────────────────

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Groq helper (used as fallback) ───────────────────────────────────────────

async function callGroq(prompt) {
  const completion = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  return completion.choices[0].message.content;
}

async function streamGroq(prompt, onChunk) {
  const stream = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    stream: true,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) onChunk(text);
  }
}

// ── Main callAI (non-streaming) ──────────────────────────────────────────────

export async function callAI(prompt) {
  try {
    const result = await geminiModel.generateContent(prompt);
    return { text: result.response.text(), provider: 'gemini' };
  } catch (err) {
    const isRateLimited = err.status === 429 || err.message?.includes('quota');
    if (isRateLimited) {
      console.warn('[AI] Gemini rate limited — switching to Groq');
      const text = await callGroq(prompt);
      return { text, provider: 'groq' };
    }
    throw err;
  }
}

// ── Streaming callAI ─────────────────────────────────────────────────────────

export async function streamAI(prompt, onChunk, onProvider) {
  try {
    onProvider('gemini');
    const result = await geminiModel.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
  } catch (err) {
    const shouldFallback =
      err.status === 429 ||
      err.status === 500 ||
      err.status === 503 ||
      err.message?.includes('quota') ||
      err.message?.includes('overloaded') ||
      err.message?.includes('timeout') ||
      err.message?.includes('network') ||
      err.message?.includes('API key');
    if (shouldFallback) {
      console.warn('[AI] Gemini fallback needed during stream — switching to Groq');
      onProvider('groq');
      await streamGroq(prompt, onChunk);
    } else {
      throw err;
    }
  }
}