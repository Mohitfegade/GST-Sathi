import React from "react";
import Link from "next/link";

export interface ButtonProps {
  variant?: "primary" | "secondary";
  href?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  "aria-label"?: string;
}

export function Button({
  variant = "primary",
  href,
  children,
  className = "",
  disabled = false,
  type = "button",
  onClick,
  "aria-label": ariaLabel,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-[8px] text-[16px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variantStyles =
    variant === "secondary"
      ? "bg-background text-ink border border-line hover:bg-surface"
      : "bg-accent text-on-accent hover:bg-accent-hover";

  const disabledLinkStyles = disabled ? "opacity-50 pointer-events-none" : "";

  const combinedClassName = `${baseStyles} ${variantStyles} ${disabledLinkStyles} ${className}`
    .trim()
    .replace(/\s+/g, " ");

  if (href) {
    return (
      <Link
        href={href}
        className={combinedClassName}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      className={combinedClassName}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
    >
      {children}
    </button>
  );
}

export default Button;
