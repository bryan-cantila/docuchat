// Auth gate: email/password sign in / sign up via Supabase Auth.
// Rendered on first visit until a session exists (portfolio pattern).

"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthGate({
  onAuthed,
}: {
  onAuthed: (user: User) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabase();
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { data, error: authError } = await fn;
      if (authError) throw authError;
      if (data.user) onAuthed(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3 mb-1">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
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
          <h1 className="text-xl font-semibold">DocuChat</h1>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          Chat with your documents. Sign in to your Supabase project to begin —
          your files stay in your own database.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          {mode === "signin"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>
        <p className="mt-5 text-center text-xs text-slate-500">
          Created by devuvo
        </p>
      </div>
    </div>
  );
}
