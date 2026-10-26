'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Sends a one-time 6-digit verification code to the invited user's email.
 */
export async function sendInviteOtp(
  token: string,
  email: string
): Promise<{ ok: boolean; message: string }> {
  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      ok: false,
      message: error.message || 'Failed to send 6-digit code. Please try again.',
    };
  }

  return { ok: true, message: 'We sent a 6-digit code to your email.' };
}

/**
 * Verifies the 6-digit OTP, accepts the client invitation via RPC, and redirects to /portal.
 */
export async function verifyAndAcceptInvite(
  token: string,
  email: string,
  otp: string
): Promise<{ ok: boolean; message: string } | never> {
  const cleanToken = token?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanOtp = otp?.trim();

  if (!cleanToken || !cleanEmail || !cleanOtp) {
    return { ok: false, message: 'Token, email, and 6-digit code are required.' };
  }

  const supabase = await createClient();

  const { error: otpError } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanOtp,
    type: 'email',
  });

  if (otpError) {
    return {
      ok: false,
      message: otpError.message || 'Invalid or expired code. Please try again.',
    };
  }

  const { error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> }).rpc('accept_client_invite', {
    p_token: cleanToken,
  });

  if (rpcError) {
    return {
      ok: false,
      message: rpcError.message || 'Failed to accept invitation. Please try again.',
    };
  }

  redirect('/portal');
}

/**
 * Form action wrapper for Step 1: Send OTP.
 */
export async function sendInviteOtpAction(formData: FormData): Promise<void> {
  const token = (formData.get('token') as string) || '';
  const email = (formData.get('email') as string) || '';

  if (!email || !email.includes('@')) {
    redirect(`/invite/${token}?error=${encodeURIComponent('Please enter a valid email address.')}`);
  }

  const result = await sendInviteOtp(token, email);

  if (!result.ok) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.message)}`);
  }

  redirect(
    `/invite/${token}?step=2&email=${encodeURIComponent(email)}&message=${encodeURIComponent(result.message)}`
  );
}

/**
 * Form action wrapper for Step 2: Verify & Accept Invite.
 */
export async function verifyAndAcceptInviteAction(formData: FormData): Promise<void> {
  const token = (formData.get('token') as string) || '';
  const email = (formData.get('email') as string) || '';
  const otp = (formData.get('otp') as string) || '';

  if (!otp || otp.trim().length !== 6) {
    redirect(
      `/invite/${token}?step=2&email=${encodeURIComponent(email)}&error=${encodeURIComponent('Please enter a 6-digit code.')}`
    );
  }

  const result = await verifyAndAcceptInvite(token, email, otp);

  if (result && !result.ok) {
    redirect(
      `/invite/${token}?step=2&email=${encodeURIComponent(email)}&error=${encodeURIComponent(result.message)}`
    );
  }
}
