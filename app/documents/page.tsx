// /documents — document library: drag-and-drop upload, list, delete.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import AuthGate from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase-browser";

interface DocRow {
  id: string;
  filename: string;
  char_count: number;
  chunk_count: number;
  status: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DocumentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        setUser(u);
      } catch {
        setUser(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      /* offline / not configured yet */
    }
  }, []);

  useEffect(() => {
    if (user) loadDocs();
  }, [user, loadDocs]);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function deleteDoc(id: string, filename: string) {
    if (!window.confirm(`Delete "${filename}" and all its chunks?`)) return;
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed.");
      }
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <AuthGate onAuthed={setUser} />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="18" height="12" rx="2" fill="#4f46e5" />
              <path
                d="M8 20h8M12 16v4"
                stroke="#818cf8"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M7 9h6M7 12h4"
                stroke="#e0e7ff"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <h1 className="font-semibold">Documents</h1>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200">
            Back to chat
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-indigo-500 bg-indigo-950/40"
              : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="mx-auto mb-3 text-slate-500"
          >
            <path
              d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {uploading ? (
            <p className="text-sm text-indigo-300">
              Ingesting {uploading} — chunking and embedding…
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Drag and drop a file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, TXT or Markdown · up to 10MB
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-medium">
              Library ({docs.length} document{docs.length === 1 ? "" : "s"})
            </h2>
          </div>
          {docs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nothing here yet — upload your first document above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Chunks</th>
                    <th className="px-4 py-2.5 font-medium">Characters</th>
                    <th className="px-4 py-2.5 font-medium">Uploaded</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 max-w-[220px] truncate text-slate-200">
                        {d.filename}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{d.chunk_count}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {d.char_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatDate(d.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteDoc(d.id, d.filename)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600">
          DocuChat · Created by devuvo
        </p>
      </main>
    </div>
  );
}
