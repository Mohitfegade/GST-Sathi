import React from "react";

export interface FormErrorProps {
  message?: string | null;
  id?: string;
  className?: string;
}

export function FormError({ message, id, className = "" }: FormErrorProps) {
  if (!message) {
    return null;
  }

  const combinedClassName =
    `w-full rounded-lg border-2 border-ink bg-surface p-4 text-ink ${className}`
      .trim()
      .replace(/\s+/g, " ");

  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={combinedClassName}
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 shrink-0 mt-0.5 text-ink"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-base font-semibold leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}

export default FormError;
