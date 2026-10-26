import React from "react";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  id?: string;
  name?: string;
  type?: string;
  error?: boolean | string;
  className?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      id,
      name,
      type = "text",
      error,
      className = "",
      disabled,
      ...props
    },
    ref
  ) {
    const hasError = Boolean(error);
    const describedBy =
      props["aria-describedby"] ?? (hasError && id ? `${id}-error` : undefined);

    const baseStyles =
      "w-full min-h-[48px] h-12 px-3.5 py-2.5 text-base rounded-lg bg-background text-ink placeholder:text-muted transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-surface disabled:cursor-not-allowed";

    const stateStyles = hasError
      ? "border-2 border-ink focus:border-ink focus:ring-ink"
      : "border border-line focus:border-accent focus:ring-accent";

    const combinedClassName = `${baseStyles} ${stateStyles} ${className}`
      .trim()
      .replace(/\s+/g, " ");

    return (
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        disabled={disabled}
        aria-invalid={props["aria-invalid"] ?? (hasError ? true : undefined)}
        aria-describedby={describedBy}
        className={combinedClassName}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;
