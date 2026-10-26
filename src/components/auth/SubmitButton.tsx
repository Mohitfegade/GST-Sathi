"use client";

import React from "react";
import { useFormStatus } from "react-dom";

export interface SubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({
  children,
  pendingText = "Please wait...",
  disabled = false,
  className = "",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  const baseStyles =
    "w-full inline-flex items-center justify-center min-h-[48px] h-12 px-6 py-3 rounded-lg text-base font-semibold transition-colors bg-accent text-on-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const combinedClassName = `${baseStyles} ${className}`
    .trim()
    .replace(/\s+/g, " ");

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      className={combinedClassName}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="h-5 w-5 animate-spin text-on-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{pendingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default SubmitButton;
