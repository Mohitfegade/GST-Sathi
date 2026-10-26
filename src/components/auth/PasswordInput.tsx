"use client";

import React, { useState } from "react";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  id?: string;
  name?: string;
  error?: boolean | string;
  className?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      id,
      name,
      error,
      className = "",
      disabled,
      ...props
    },
    ref
  ) {
    const [showPassword, setShowPassword] = useState(false);
    const hasError = Boolean(error);
    const describedBy =
      props["aria-describedby"] ?? (hasError && id ? `${id}-error` : undefined);

    const baseStyles =
      "w-full min-h-[48px] h-12 pl-3.5 pr-24 py-2.5 text-base rounded-lg bg-background text-ink placeholder:text-muted transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-surface disabled:cursor-not-allowed";

    const stateStyles = hasError
      ? "border-2 border-ink focus:border-ink focus:ring-ink"
      : "border border-line focus:border-accent focus:ring-accent";

    const combinedClassName = `${baseStyles} ${stateStyles} ${className}`
      .trim()
      .replace(/\s+/g, " ");

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          aria-invalid={props["aria-invalid"] ?? (hasError ? true : undefined)}
          aria-describedby={describedBy}
          className={combinedClassName}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center justify-center min-h-[48px] min-w-[48px] text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-lg text-xs font-semibold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-1.5 select-none uppercase">
            {showPassword ? (
              <>
                <svg
                  className="h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" x2="22" y1="2" y2="22" />
                </svg>
                <span>Hide</span>
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Show</span>
              </>
            )}
          </span>
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
