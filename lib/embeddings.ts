// OpenAI embeddings helper (text-embedding-3-small, 1536 dimensions).

import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  return new OpenAI({ apiKey });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embed a batch of texts (up to BATCH_SIZE per API call) with exponential
 * backoff on rate limits / transient failures.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > BATCH_SIZE) {
    throw new Error(`embedBatch accepts at most ${BATCH_SIZE} texts per call.`);
  }
  const client = getClient();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      // Retry on rate limits and 5xx; fail fast on auth / bad request.
      if (status === 401 || status === 400) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Embedding request failed after retries.");
}

/** Embed many texts in batches of BATCH_SIZE. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = await embedBatch(texts.slice(i, i + BATCH_SIZE));
    out.push(...batch);
  }
  return out;
}

/** Embed a single query string (for retrieval). */
export async function embedQuery(query: string): Promise<number[]> {
  const [vec] = await embedBatch([query]);
  return vec;
}
