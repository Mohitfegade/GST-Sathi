'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import { signUpAction } from './actions';
import { siteConfig } from '@/config/site';

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(signUpAction, null);

  const isError = Boolean(state && !state.ok);
  const errorField = state && !state.ok ? state.field : undefined;
  const errorMessage = state && !state.ok ? state.message : undefined;

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Document Title for React 19 */}
      <title>{`Create your accounting firm account - ${siteConfig.name}`}</title>
      <meta
        name="description"
        content="Create your accounting firm account to automate GST reconciliation, verify returns, and support your clients."
      />

      <div className="w-full max-w-md mx-auto">
        {/* Brand & Heading */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center min-h-[48px] py-2 text-2xl font-bold tracking-tight text-ink mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
          >
            {siteConfig.name}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">
            Create your accounting firm account
          </h1>
          <p className="mt-2 text-base text-muted">
            Manage your clients and GST compliance securely.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line rounded-[12px] p-6 sm:p-8">
          {/* Form Level Error Alert */}
          {isError && errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 p-4 rounded-[8px] bg-background border border-line text-ink text-sm font-medium"
            >
              <div className="flex items-start gap-2">
                <span className="font-bold">Error:</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form
            action={formAction}
            aria-label="Create your accounting firm account"
            className="space-y-4"
            noValidate={false}
          >
            {/* Full Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={errorField === 'name' ? 'true' : undefined}
                aria-describedby={errorField === 'name' ? 'name-error' : undefined}
                placeholder="Ramesh Patel"
                className="w-full min-h-[48px] h-12 px-4 text-base text-ink bg-background border border-line rounded-[8px] placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {errorField === 'name' && (
                <p id="name-error" className="text-sm text-ink font-medium mt-1.5">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={errorField === 'email' ? 'true' : undefined}
                aria-describedby={errorField === 'email' ? 'email-error' : undefined}
                placeholder="ramesh@example.com"
                className="w-full min-h-[48px] h-12 px-4 text-base text-ink bg-background border border-line rounded-[8px] placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {errorField === 'email' && (
                <p id="email-error" className="text-sm text-ink font-medium mt-1.5">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  aria-required="true"
                  aria-invalid={errorField === 'password' ? 'true' : undefined}
                  aria-describedby={
                    errorField === 'password'
                      ? 'password-hint password-error'
                      : 'password-hint'
                  }
                  placeholder="At least 10 characters"
                  className="w-full min-h-[48px] h-12 pl-4 pr-16 text-base text-ink bg-background border border-line rounded-[8px] placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
              <p id="password-hint" className="text-xs text-muted mt-1.5">
                Must be at least 10 characters long.
              </p>
              {errorField === 'password' && (
                <p
                  id="password-error"
                  className="text-sm text-ink font-medium mt-1.5"
                >
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Firm Name Field */}
            <div>
              <label
                htmlFor="firmName"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Accounting firm or practice name
              </label>
              <input
                id="firmName"
                name="firmName"
                type="text"
                autoComplete="organization"
                required
                aria-required="true"
                aria-invalid={errorField === 'firmName' ? 'true' : undefined}
                aria-describedby={
                  errorField === 'firmName' ? 'firmName-error' : undefined
                }
                placeholder="Patel & Associates"
                className="w-full min-h-[48px] h-12 px-4 text-base text-ink bg-background border border-line rounded-[8px] placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {errorField === 'firmName' && (
                <p
                  id="firmName-error"
                  className="text-sm text-ink font-medium mt-1.5"
                >
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label
                htmlFor="agreeTerms"
                className="min-h-[48px] flex items-start gap-3 cursor-pointer py-1 select-none"
              >
                <input
                  id="agreeTerms"
                  name="agreeTerms"
                  type="checkbox"
                  required
                  aria-required="true"
                  aria-invalid={errorField === 'agreeTerms' ? 'true' : undefined}
                  aria-describedby={
                    errorField === 'agreeTerms' ? 'agreeTerms-error' : undefined
                  }
                  className="mt-1 h-5 w-5 rounded border-line text-accent accent-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 shrink-0 cursor-pointer"
                />
                <span className="text-sm text-muted leading-relaxed">
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    className="text-accent underline underline-offset-4 hover:text-accent-hover font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[2px]"
                    target="_blank"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    className="text-accent underline underline-offset-4 hover:text-accent-hover font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[2px]"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errorField === 'agreeTerms' && (
                <p
                  id="agreeTerms-error"
                  className="text-sm text-ink font-medium mt-1.5"
                >
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="w-full min-h-[48px] h-12 px-6 bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-[8px] text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {isPending ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>

          {/* Link to Login */}
          <div className="mt-6 pt-6 border-t border-line text-center">
            <p className="text-sm text-muted">
              Already have an account?{' '}
              <Link
                href="/login"
                className="inline-flex items-center min-h-[48px] font-semibold text-accent underline underline-offset-4 hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted">
          <p>&copy; 2026 {siteConfig.name}. All rights reserved.</p>
        </div>
      </div>
    </main>
  );
}
