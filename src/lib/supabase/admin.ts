import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Creates a Supabase admin client configured with the service role key.
 * Bypasses Row Level Security (RLS). Must ONLY be invoked on the server side.
 * The `'server-only'` import at line 1 guarantees build-time isolation from browser code.
 */
export function createAdminClient<Database = Record<string, unknown>>(
  options?: Parameters<typeof createClient<Database>>[2]
) {
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      '[admin] SUPABASE_SERVICE_ROLE_KEY is required to initialize the admin client. Please configure this environment variable on your server.'
    );
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...options,
    }
  );
}
