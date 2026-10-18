// POST /api/chat — RAG: embed the last user message, retrieve matching chunks
// from pgvector, then stream a grounded answer with cited sources.
// Sources travel as a `data-sources` stream part so the UI can render them.

import { NextRequest, NextResponse } from "next/server";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { retrieveSources, buildSystemPrompt } from "@/lib/rag";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";

export const maxDuration = 60;

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabase();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const messages = (body.messages ?? []) as UIMessage[];
    const scopedDocIds = (body.docIds ?? []) as string[];

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUser ? getTextFromMessage(lastUser) : "";
    if (!query) {
      return NextResponse.json({ error: "No user message found." }, { status: 400 });
    }

    const db = createServiceSupabase();
    let sources = await retrieveSources(db, user.id, query);
    if (scopedDocIds.length > 0) {
      const scoped = new Set(scopedDocIds);
      sources = sources.filter((s) => scoped.has(s.document_id));
    }
    const system = buildSystemPrompt(sources);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Sources first, so the UI can show citations as the answer streams in.
        writer.write({
          type: "data-sources",
          data: { sources },
        });
        const result = streamText({
          model: openai("gpt-4o-mini"),
          system,
          messages: await convertToModelMessages(messages),
        });
        writer.merge(result.toUIMessageStream());
      },
      onError: (error) =>
        error instanceof Error ? error.message : "Chat failed.",
    });

    return createUIMessageStreamResponse({ stream });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
