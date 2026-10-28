import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { getSessionContext } from './session';
import type { SessionContext } from './types';

/**
 * Ensures the user has an active session.
 * If unauthenticated, redirects to `/login`.
 *
 * @param customClient - Optional Supabase client instance (passed to getSessionContext)
 */
export async function requireUser(
  customClient?: SupabaseClient
): Promise<SessionContext> {
  if (!customClient) {
    try {
      const { connection } = await import('next/server');
      await connection();
    } catch {
      // outside Next.js request context (e.g. unit tests)
    }
  }

  const session = await getSessionContext(customClient);

  if (!session) {
    redirect('/login');
  }

  return session;
}
