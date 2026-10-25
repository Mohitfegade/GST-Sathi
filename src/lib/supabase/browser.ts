import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Creates a Supabase client for browser and client-side components using `@supabase/ssr`.
 * Utilizes the validated public Supabase URL and anon key from `src/lib/env.ts`.
 */
export function createBrowserClient<Database = Record<string, unknown>>(
  options?: Parameters<typeof createSupabaseBrowserClient<Database>>[2]
) {
  return createSupabaseBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options
  );
}

// Canonical alias
export const createClient = createBrowserClient;
