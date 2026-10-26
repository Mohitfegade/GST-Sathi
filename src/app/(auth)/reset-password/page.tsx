'use client';

import React, { Suspense, useActionState, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPasswordAction, type ResetPasswordState } from './actions';

const initialState: ResetPasswordState = {
  ok: false,
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';

  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialState
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            Choose a new password
          </h1>
          <p className="mt-2 text-base sm:text-lg text-muted leading-relaxed">
            Must be at least 10 characters long.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line rounded-[12px] p-6 sm:p-8">
          <form action={formAction} className="space-y-6">
            {code && <input type="hidden" name="code" value={code} />}

            {state.message && !state.ok && (
              <div
                role="alert"
                className="p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
              >
                {state.message}
              </div>
            )}

            {/* New Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  placeholder="At least 10 characters"
                  className="w-full min-h-[48px] h-12 pl-4 pr-16 text-base text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute inset-y-0 right-0 px-4 min-h-[48px] min-w-[48px] flex items-center justify-center text-sm font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-[8px]"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  placeholder="Re-enter your new password"
                  className="w-full min-h-[48px] h-12 pl-4 pr-16 text-base text-ink bg-background border border-line rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  className="absolute inset-y-0 right-0 px-4 min-h-[48px] min-w-[48px] flex items-center justify-center text-sm font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-[8px]"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="w-full min-h-[48px] h-12 px-6 inline-flex items-center justify-center bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              {isPending ? 'Updating password...' : 'Update password'}
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
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md mx-auto text-center">
            <p className="text-base text-muted">Loading...</p>
          </div>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
