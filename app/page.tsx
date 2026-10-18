// DocuChat main screen: sidebar (documents + retrieval scope) + streaming chat
// with cited sources.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import AuthGate from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Source } from "@/lib/rag";

interface DocRow {
  id: string;
  filename: string;
  chunk_count: number;
}

function getMessageText(m: UIMessage): string {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

function getMessageSources(m: UIMessage): Source[] {
  for (const p of m.parts) {
    if (p.type === "data-sources") {
      const data = (p as { data?: { sources?: Source[] } }).data;
      if (data?.sources) return data.sources;
    }
  }
  return [];
}

function SourcesPanel({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14l-4-3-4 3-4-3-4 3V5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        Sources ({sources.length})
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div
              key={s.chunk_id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-slate-200 truncate">
                  [{i + 1}] {s.filename}
                </span>
                <span className="shrink-0 text-slate-500">
                  {Math.round(s.similarity * 100)}% match
                </span>
              </div>
              <p className="text-slate-400 line-clamp-3">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [scoped, setScoped] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { docIds: [...scoped] },
      }),
    [scoped]
  );

  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleScope(id: string) {
    setScoped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    setUser(null);
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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/40 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
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
            <div>
              <h1 className="font-semibold leading-tight">DocuChat</h1>
              <p className="text-[11px] text-slate-500">Created by devuvo</p>
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Documents
            </h2>
            <Link
              href="/documents"
              className="text-xs text-indigo-300 hover:text-indigo-200"
            >
              Manage
            </Link>
          </div>
          {docs.length === 0 ? (
            <p className="text-xs text-slate-500">
              No documents yet. Upload PDFs or text files to start asking
              questions.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 mb-2">
                Tick to limit answers to specific documents (unticked = search
                all).
              </p>
              <ul className="space-y-1.5">
                {docs.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={scoped.has(d.id)}
                        onChange={() => toggleScope(d.id)}
                        className="mt-0.5 accent-indigo-500"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-slate-200">
                          {d.filename}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {d.chunk_count} chunks
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href="/documents"
            className="mt-3 flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-slate-700 px-3 py-2.5 text-sm text-slate-300 hover:border-indigo-500 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Upload documents
          </Link>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={signOut}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Sign out
          </button>
          <p className="mt-1 text-[11px] text-slate-600">
            DocuChat · Created by devuvo
          </p>
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col min-h-[70vh]">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
                <h2 className="text-base font-medium text-slate-200 mb-2">
                  How it works
                </h2>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>Upload PDFs, .txt or .md files in the Documents page.</li>
                  <li>
                    Each file is split into chunks and embedded into your
                    Supabase database.
                  </li>
                  <li>
                    Ask a question here — DocuChat finds the most relevant
                    chunks and answers with cited sources.
                  </li>
                </ol>
                <p className="mt-3 text-xs text-slate-500">
                  Answers come only from your documents. If the answer is not
                  in them, DocuChat says so instead of guessing.
                </p>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === "user";
              const text = getMessageText(m);
              const sources = getMessageSources(m);
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      isUser
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-800 bg-slate-900/60 text-slate-200"
                    }`}
                  >
                    <div
                      className={`chat-text whitespace-pre-wrap ${
                        !isUser && busy && m === messages[messages.length - 1]
                          ? "streaming-caret"
                          : ""
                      }`}
                    >
                      {text}
                    </div>
                    {!isUser && <SourcesPanel sources={sources} />}
                  </div>
                </div>
              );
            })}
            {error && (
              <p className="text-sm text-red-400">
                Something went wrong: {error.message}
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-slate-800 p-4 bg-slate-900/40"
        >
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                docs.length === 0
                  ? "Upload documents first, then ask…"
                  : "Ask about your documents…"
              }
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-medium hover:bg-slate-600"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-600">
            Answers are grounded in your documents · Created by devuvo
          </p>
        </form>
      </main>
    </div>
  );
}
