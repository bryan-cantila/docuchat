// RAG: retrieve relevant chunks and build the grounded system prompt.

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "./embeddings";

export interface Source {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
}

const TOP_K = 6;
const MIN_SIMILARITY = 0.3;

export async function retrieveSources(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<Source[]> {
  const queryEmbedding = await embedQuery(query);
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_user: userId,
    match_count: TOP_K,
  });
  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }
  const rows = (data ?? []) as Source[];
  return rows.filter((r) => r.similarity >= MIN_SIMILARITY);
}

export function buildSystemPrompt(sources: Source[]): string {
  if (sources.length === 0) {
    return (
      "You are DocuChat, a helpful assistant. The user has not uploaded any " +
      "documents yet, or none of their documents matched the question. " +
      "Explain briefly that you can only answer from their uploaded documents, " +
      "and ask them to upload documents or rephrase. Do not invent facts."
    );
  }
  const context = sources
    .map(
      (s, i) =>
        `[${i + 1}] (from "${s.filename}")\n${s.content}`
    )
    .join("\n\n---\n\n");
  return (
    "You are DocuChat, a helpful assistant that answers questions using ONLY " +
    "the document excerpts below. Rules:\n" +
    "1. Base every factual claim on the provided excerpts.\n" +
    "2. Cite each claim with the excerpt number like [1], [2].\n" +
    "3. If the excerpts do not contain the answer, say so plainly — do not " +
    "invent or use outside knowledge.\n" +
    "4. Keep answers concise and in the user's language.\n\n" +
    "Document excerpts:\n" +
    context
  );
}
