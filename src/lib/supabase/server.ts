import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import type { CookieOptionsWithName } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Creates a Supabase client for Next.js App Router (Server Components, Route Handlers, Server Actions).
 * Uses `@supabase/ssr` with async cookies resolution.
 */
export async function createServerClient<Database = Record<string, unknown>>(
  cookieStore?: Awaited<ReturnType<typeof cookies>>
) {
  const resolvedCookieStore = cookieStore ?? (await cookies());

  return createSupabaseServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return resolvedCookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: CookieOptionsWithName;
          }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              resolvedCookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be safely ignored if middleware is handling session refresh.
          }
        },
      },
    }
  );
}

// Canonical alias
export const createClient = createServerClient;
