'use client';

import React, { Suspense, useState, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  loginWithPassword,
  sendLoginOtp,
  verifyLoginOtp,
  type AuthActionState,
} from './actions';

const initialAuthState: AuthActionState = {
  ok: false,
};

function LoginForm() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') ?? '';

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forceShowEmailInput, setForceShowEmailInput] = useState(false);

  const [passwordState, passwordAction, isPasswordPending] = useActionState(
    loginWithPassword,
    initialAuthState
  );

  const [otpSendState, otpSendAction, isOtpSendPending] = useActionState(
    sendLoginOtp,
    initialAuthState
  );

  const [otpVerifyState, otpVerifyAction, isOtpVerifyPending] = useActionState(
    verifyLoginOtp,
    initialAuthState
  );

  const isCodeRequested = !forceShowEmailInput && Boolean(otpSendState.codeSent);

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        {/* Brand & Heading */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center min-h-[48px] py-2 text-2xl font-bold tracking-tight text-ink mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
          >
            GST Saathi
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">
            Log in to GST Saathi
          </h1>
          <p className="mt-2 text-base text-muted">
            Manage your clients and GST compliance securely.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line rounded-[12px] p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          <div
            role="tablist"
            aria-label="Login options"
            className="flex border-b border-line mb-6"
          >
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'password'}
              onClick={() => setMode('password')}
              className={`flex-1 min-h-[48px] py-3 text-center text-base font-semibold transition-colors border-b-2 -mb-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                mode === 'password'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Password
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'otp'}
              onClick={() => {
                setMode('otp');
                setForceShowEmailInput(false);
              }}
              className={`flex-1 min-h-[48px] py-3 text-center text-base font-semibold transition-colors border-b-2 -mb-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                mode === 'otp'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Email code
            </button>
          </div>

          {/* Mode 1: Password Login */}
          {mode === 'password' && (
            <form action={passwordAction} className="space-y-4">
              <input type="hidden" name="next" value={nextParam} />

              <div>
                <label
                  htmlFor="password-email"
                  className="block text-sm font-semibold text-ink mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="password-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ca@example.com"
                  className="w-full min-h-[48px] h-12 px-4 text-base text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password-input"
                    className="block text-sm font-semibold text-ink"
                  >
                    Password
                  </label>
                  <Link
                    href={
                      nextParam
                        ? `/forgot-password?next=${encodeURIComponent(nextParam)}`
                        : '/forgot-password'
                    }
                    className="text-sm font-medium text-accent hover:underline min-h-[48px] inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    className="w-full min-h-[48px] h-12 pl-4 pr-16 text-base text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-4 min-h-[48px] min-w-[48px] flex items-center justify-center text-sm font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-[8px]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {passwordState.message && !passwordState.ok && (
                <div
                  role="alert"
                  className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
                >
                  {passwordState.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isPasswordPending}
                className="w-full min-h-[48px] h-12 px-6 bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {isPasswordPending ? 'Logging in...' : 'Log in'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                setMode('otp');
                setForceShowEmailInput(false);
              }}
                  className="min-h-[48px] px-4 inline-flex items-center justify-center text-base font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                >
                  Email me a code instead
                </button>
              </div>
            </form>
          )}

          {/* Mode 2: Magic code / OTP login */}
          {mode === 'otp' && (
            <div className="space-y-4">
              {!isCodeRequested ? (
                /* Step A: Request Code */
                <form action={otpSendAction} onSubmit={() => setForceShowEmailInput(false)} className="space-y-4">
                  <input type="hidden" name="next" value={nextParam} />

                  <div>
                    <label
                      htmlFor="otp-email"
                      className="block text-sm font-semibold text-ink mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="otp-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ca@example.com"
                      className="w-full min-h-[48px] h-12 px-4 text-base text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <p className="mt-1.5 text-sm text-muted">
                      We will email you a 6-digit one-time code to log in.
                    </p>
                  </div>

                  {otpSendState.message && !otpSendState.ok && (
                    <div
                      role="alert"
                      className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
                    >
                      {otpSendState.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isOtpSendPending}
                    className="w-full min-h-[48px] h-12 px-6 bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  >
                    {isOtpSendPending ? 'Sending code...' : 'Send code'}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('password')}
                      className="min-h-[48px] px-4 inline-flex items-center justify-center text-base font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                    >
                      Log in with password instead
                    </button>
                  </div>
                </form>
              ) : (
                /* Step B: Verify Code */
                <div className="space-y-4">
                  <div
                    role="status"
                    className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm"
                  >
                    <p className="font-medium">
                      {otpSendState.message ||
                        'If an account exists for this email, a 6-digit code has been sent.'}
                    </p>
                    <p className="mt-1 text-muted">Sent to: {email}</p>
                  </div>

                  <form action={otpVerifyAction} className="space-y-4">
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="next" value={nextParam} />

                    <div>
                      <label
                        htmlFor="otp-code"
                        className="block text-sm font-semibold text-ink mb-1.5"
                      >
                        6-digit code
                      </label>
                      <input
                        id="otp-code"
                        name="code"
                        type="text"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="123456"
                        className="w-full min-h-[48px] h-12 px-4 text-center tracking-[0.25em] text-xl font-mono text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>

                    {otpVerifyState.message && !otpVerifyState.ok && (
                      <div
                        role="alert"
                        className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
                      >
                        {otpVerifyState.message}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isOtpVerifyPending}
                      className="w-full min-h-[48px] h-12 px-6 bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                    >
                      {isOtpVerifyPending ? 'Verifying...' : 'Verify and log in'}
                    </button>
                  </form>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-line">
                    <form action={otpSendAction}>
                      <input type="hidden" name="email" value={email} />
                      <input type="hidden" name="next" value={nextParam} />
                      <button
                        type="submit"
                        disabled={isOtpSendPending}
                        className="min-h-[48px] px-3 inline-flex items-center justify-center text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px] disabled:opacity-50"
                      >
                        {isOtpSendPending ? 'Resending...' : 'Resend code'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setForceShowEmailInput(true)}
                      className="min-h-[48px] px-3 inline-flex items-center justify-center text-sm font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                    >
                      Use different email
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('password')}
                      className="min-h-[48px] px-4 inline-flex items-center justify-center text-base font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                    >
                      Log in with password instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Signup Link */}
        <p className="mt-6 text-center text-base text-muted">
          Don&apos;t have an account?{' '}
          <Link
            href={
              nextParam
                ? `/signup?next=${encodeURIComponent(nextParam)}`
                : '/signup'
            }
            className="font-semibold text-accent hover:underline ml-1 min-h-[48px] inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-line rounded-[12px] p-8 text-center text-muted">
            Loading login...
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
