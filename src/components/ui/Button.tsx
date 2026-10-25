import React from "react";
import Link from "next/link";

export interface ButtonProps {
  variant?: "primary" | "secondary";
  href?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({
  variant = "primary",
  href,
  children,
  className = "",
  disabled,
  onClick,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-[8px] text-[16px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variantStyles =
    variant === "primary"
      ? "bg-accent text-on-accent hover:bg-accent-hover"
      : "bg-background text-ink border border-line hover:bg-surface";

  const combinedClassName = `${baseStyles} ${variantStyles} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={combinedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={combinedClassName}
    >
      {children}
    </button>
  );
}
