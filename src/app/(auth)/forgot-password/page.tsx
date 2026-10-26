'use client';

import React, { useActionState, useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

const initialState: ForgotPasswordState = {
  ok: false,
};

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    initialState
  );
  const [email, setEmail] = useState('');

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        {/* Brand Link & Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center min-h-[48px] py-2 text-2xl font-bold tracking-tight text-ink mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
          >
            GST Saathi
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Reset your password
          </h1>
          <p className="mt-2 text-base sm:text-lg text-muted leading-relaxed">
            Enter your email address and we will send you a link to reset your password.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line rounded-[12px] p-6 sm:p-8">
          {state.ok ? (
            /* Success confirmation banner */
            <div className="space-y-6">
              <div
                role="status"
                aria-live="polite"
                className="p-4 rounded-[8px] bg-background border border-line text-ink"
              >
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 shrink-0 mt-0.5 text-accent"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      Check your email
                    </h2>
                    <p className="mt-1 text-sm sm:text-base text-muted leading-relaxed">
                      {state.message ||
                        'If an account exists with this email, we have sent instructions to reset your password.'}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted">
                Did not receive an email? Check your spam folder or try again with a different email address.
              </p>

              <div>
                <Link
                  href="/login"
                  className="w-full min-h-[48px] h-12 px-6 inline-flex items-center justify-center bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            /* Reset Request Form */
            <form action={formAction} className="space-y-6">
              {state.message && !state.ok && (
                <div
                  role="alert"
                  className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
                >
                  {state.message}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-ink mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
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

              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="w-full min-h-[48px] h-12 px-6 inline-flex items-center justify-center bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {isPending ? 'Sending reset link...' : 'Send reset link'}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="min-h-[48px] px-4 inline-flex items-center justify-center text-sm font-medium text-muted hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
