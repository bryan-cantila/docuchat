// Supabase SERVER helpers (route handlers / server components only).
// Imports next/headers — never import this file from a client component.

import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./supabase-env";

/** Server client bound to the request cookies (reads the logged-in user). */
export async function createServerSupabase() {
  const { url, anonKey, missing } = getSupabaseEnv();
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  const cookieStore = await cookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component where setting cookies is not allowed.
        }
      },
    },
  });
}

/** Service-role client for API routes (bypasses RLS — always filter by user_id). */
export function createServiceSupabase() {
  const { url, serviceRoleKey, missing } = getSupabaseEnv();
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return createJsClient(url!, serviceRoleKey!);
}
