// /api/documents — upload + ingest, list, delete.
// Auth: user is read from the Supabase session cookie; every query is
// filtered by that user's id. DB writes use the service-role client.

import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";

export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [".pdf", ".txt", ".md"];

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// POST: multipart form with a "file" field → extract, chunk, embed, store.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Not authenticated.", 401);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file uploaded.", 400);

    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return jsonError("Only .pdf, .txt and .md files are supported.", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("File is larger than the 10MB limit.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (ext === ".pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else {
      text = buffer.toString("utf-8");
    }
    text = text.trim();
    if (text.length < 20) {
      return jsonError("No readable text found in this file.", 400);
    }

    const chunks = chunkText(text);
    const vectors = await embedTexts(chunks);

    const db = createServiceSupabase();
    const { data: doc, error: docError } = await db
      .from("documents")
      .insert({
        user_id: user.id,
        filename: file.name,
        char_count: text.length,
        chunk_count: chunks.length,
        status: "ready",
      })
      .select("id, filename, chunk_count")
      .single();
    if (docError || !doc) {
      return jsonError(`Could not save document: ${docError?.message}`, 500);
    }

    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      user_id: user.id,
      chunk_index: i,
      content,
      embedding: vectors[i],
    }));
    // Insert in batches to stay well under payload limits.
    for (let i = 0; i < rows.length; i += 100) {
      const { error: chunkError } = await db
        .from("document_chunks")
        .insert(rows.slice(i, i + 100));
      if (chunkError) {
        await db.from("documents").delete().eq("id", doc.id).eq("user_id", user.id);
        return jsonError(`Could not save chunks: ${chunkError.message}`, 500);
      }
    }

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      chunk_count: doc.chunk_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return jsonError(message, 500);
  }
}

// GET: list the user's documents with chunk counts.
export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Not authenticated.", 401);
    const db = createServiceSupabase();
    const { data, error } = await db
      .from("documents")
      .select("id, filename, char_count, chunk_count, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "List failed.";
    return jsonError(message, 500);
  }
}

// DELETE /api/documents?id= — remove a document (chunks cascade).
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Not authenticated.", 401);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return jsonError("Missing id.", 400);
    const db = createServiceSupabase();
    const { error } = await db
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    return jsonError(message, 500);
  }
}
