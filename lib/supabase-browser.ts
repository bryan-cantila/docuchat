// Supabase BROWSER client (client components only) — for the auth gate
// (sign in / sign up / sign out). No next/headers here.

"use client";

import { createClient } from "@supabase/supabase-js";

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createClient(url, anonKey);
}
