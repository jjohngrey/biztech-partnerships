import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for the browser (Client Components, client-side handlers).
 * Reads the public URL + anon key from NEXT_PUBLIC_* env vars.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
