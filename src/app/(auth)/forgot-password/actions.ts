'use server';

import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export interface ForgotPasswordState {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function forgotPasswordAction(
  prevState: ForgotPasswordState | null | undefined,
  formData: FormData
): Promise<ForgotPasswordState> {
  const rawEmail = formData.get('email');
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!email || !email.includes('@')) {
    return {
      ok: false,
      error: 'Please enter a valid email address.',
      message: 'Please enter a valid email address.',
    };
  }

  // Determine origin safely
  let origin = env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host');
    const proto = headersList.get('x-forwarded-proto') || 'https';
    const headerOrigin = headersList.get('origin');
    if (headerOrigin) {
      origin = headerOrigin;
    } else if (host) {
      origin = `${proto}://${host}`;
    }
  } catch {
    // Outside request scope (e.g. testing), fall back to configured site URL
  }

  const normalizedOrigin = origin.replace(/\/+$/, '');

  try {
    const supabase = await createServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${normalizedOrigin}/reset-password`,
    });
  } catch (err) {
    // Zero account enumeration: swallow error but log for server observability
    console.error('[forgot-password] resetPasswordForEmail error:', err);
  }

  // Zero account enumeration: always return the same confirmation message
  return {
    ok: true,
    message:
      'If an account exists with this email, we have sent instructions to reset your password.',
  };
}
