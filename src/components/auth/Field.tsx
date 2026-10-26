import React from "react";

export interface FieldProps {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className = "",
}: FieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;

  let renderedChildren = children;

  if (React.isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    const existingDescribedBy = childProps["aria-describedby"] as string | undefined;
    const combinedDescribedBy = [existingDescribedBy, errorId, hintId]
      .filter(Boolean)
      .join(" ") || undefined;

    renderedChildren = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      id: childProps.id ?? htmlFor,
      required: childProps.required ?? (required || undefined),
      error: childProps.error ?? (error ? true : undefined),
      "aria-invalid": childProps["aria-invalid"] ?? (error ? true : undefined),
      "aria-describedby": combinedDescribedBy,
    });
  }

  return (
    <div className={`w-full ${className}`.trim()}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink mb-1.5"
      >
        {label}
        {required && (
          <span className="ml-1 font-semibold text-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {renderedChildren}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"
        >
          <svg
            className="h-4 w-4 shrink-0 text-ink"
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
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default Field;
