import React from "react";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`max-w-[640px] ${className}`}>
      {eyebrow && (
        <p className="text-xs font-semibold tracking-wider text-muted uppercase mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-lg text-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
