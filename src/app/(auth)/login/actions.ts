'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';

export interface AuthActionState {
  ok: boolean;
  message?: string;
  field?: string;
  codeSent?: boolean;
  email?: string;
}

/**
 * Open-redirect defense: Validates redirect target is a same-origin relative path.
 * Must begin with '/' and must NOT begin with '//' or '/\'.
 */
function getValidRedirect(next?: string | null): string | null {
  if (!next || typeof next !== 'string') return null;
  const trimmed = next.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\')
  ) {
    return null;
  }
  try {
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return null;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}

/**
 * Resolves destination home route based on user membership:
 * - Validated `next` path if supplied
 * - `/app` if user is a member of an active CA firm
 * - `/portal` if user is an active client owner
 * - Fallback to `/app`
 */
export async function resolveDestination(
  supabase: SupabaseClient,
  userId: string,
  nextParam?: string | null
): Promise<string> {
  const validRedirect = getValidRedirect(nextParam);
  if (validRedirect) {
    return validRedirect;
  }

  try {
    const { data: firmMember } = await supabase
      .from('firm_members')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (firmMember) {
      return '/app';
    }

    const { data: clientAccess } = await supabase
      .from('client_access')
      .select('id, role')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (clientAccess && (clientAccess as { role?: string }).role === 'owner') {
      return '/portal';
    }
  } catch (err) {
    console.error('Error resolving destination route:', err);
  }

  return '/app';
}

/**
 * Password login server action.
 * Zero account enumeration: invalid credentials always produce a neutral error message.
 */
export async function loginWithPassword(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? '';
  const password = formData.get('password')?.toString() ?? '';
  const next = formData.get('next')?.toString() ?? '';

  if (!email || !password) {
    return {
      ok: false,
      message: 'Incorrect email or password. Please try again.',
    };
  }

  let destination = '/app';

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return {
        ok: false,
        message: 'Incorrect email or password. Please try again.',
      };
    }

    destination = await resolveDestination(supabase, data.user.id, next);
  } catch {
    return {
      ok: false,
      message: 'Incorrect email or password. Please try again.',
    };
  }

  redirect(destination);
}

/**
 * Magic code / OTP login request action.
 * Zero account enumeration: always returns neutral success message regardless of existence.
 */
export async function sendLoginOtp(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? '';

  if (!email || !email.includes('@')) {
    return {
      ok: false,
      email,
      message: 'Please enter a valid email address.',
    };
  }

  try {
    const supabase = await createServerClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
  } catch (err) {
    console.error('sendLoginOtp error:', err);
  }

  return {
    ok: true,
    codeSent: true,
    email,
    message: 'If an account exists for this email, a 6-digit code has been sent.',
  };
}

/**
 * Magic code / OTP verification action.
 * Validates the one-time code and redirects to destination upon success.
 */
export async function verifyLoginOtp(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? '';
  const rawCode = (formData.get('code') ?? formData.get('token'))?.toString() ?? '';
  const token = rawCode.trim().replace(/\s+/g, '');
  const next = formData.get('next')?.toString() ?? '';

  if (!email || !token) {
    return {
      ok: false,
      codeSent: true,
      email,
      message: 'Please enter the 6-digit code sent to your email.',
    };
  }

  let destination = '/app';

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error || !data.user) {
      return {
        ok: false,
        codeSent: true,
        email,
        message: 'Incorrect or expired code. Please try again.',
      };
    }

    destination = await resolveDestination(supabase, data.user.id, next);
  } catch {
    return {
      ok: false,
      codeSent: true,
      email,
      message: 'Incorrect or expired code. Please try again.',
    };
  }

  redirect(destination);
}

/**
 * Logout server action.
 * Signs out the current session and redirects to /login.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
