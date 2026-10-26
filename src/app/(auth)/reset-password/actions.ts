'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export interface ResetPasswordState {
  ok: boolean;
  message?: string;
  field?: 'password' | 'confirmPassword';
}

export async function resetPasswordAction(
  prevState: ResetPasswordState | null | undefined,
  formData: FormData
): Promise<ResetPasswordState> {
  const rawPassword = formData.get('password');
  const rawConfirmPassword = formData.get('confirmPassword');
  const code = formData.get('code')?.toString()?.trim();

  const password = typeof rawPassword === 'string' ? rawPassword : '';
  const confirmPassword =
    typeof rawConfirmPassword === 'string' ? rawConfirmPassword : '';

  if (!password) {
    return {
      ok: false,
      field: 'password',
      message: 'Please enter a new password.',
    };
  }

  if (password.length < 10) {
    return {
      ok: false,
      field: 'password',
      message: 'Password must be at least 10 characters long.',
    };
  }

  if (!confirmPassword) {
    return {
      ok: false,
      field: 'confirmPassword',
      message: 'Please confirm your new password.',
    };
  }

  if (password !== confirmPassword) {
    return {
      ok: false,
      field: 'confirmPassword',
      message: 'Passwords do not match. Please re-enter them.',
    };
  }

  try {
    const supabase = await createServerClient();

    // If an auth exchange code is passed via URL query parameter, exchange it for session
    if (code) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (exchangeErr) {
        console.error('[reset-password] exchangeCodeForSession error:', exchangeErr);
      }
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return {
        ok: false,
        message:
          error.message ||
          'Unable to update password. Your reset link may have expired.',
      };
    }
  } catch (err: unknown) {
    const errorObj = err as { digest?: string; message?: string };
    if (errorObj?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return {
      ok: false,
      message:
        errorObj?.message ||
        'An unexpected error occurred while updating your password.',
    };
  }

  redirect('/login?reset=success');
}
