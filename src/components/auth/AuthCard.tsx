import React from "react";

export interface AuthCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className = "",
}: AuthCardProps) {
  const combinedClassName =
    `w-full max-w-[440px] mx-auto rounded-xl border border-line bg-background p-6 sm:p-8 ${className}`
      .trim()
      .replace(/\s+/g, " ");

  return (
    <div className={combinedClassName}>
      {(title || subtitle) && (
        <div className="mb-6 text-center sm:mb-8">
          {title && (
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-base text-muted leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-6 border-t border-line pt-6 text-center text-sm text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}

export default AuthCard;
