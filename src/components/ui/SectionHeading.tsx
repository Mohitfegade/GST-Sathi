import React from "react";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className = "",
  id,
}: SectionHeadingProps) {
  return (
    <div className={`max-w-[640px] ${className}`.trim()}>
      {eyebrow && (
        <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-3">
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="text-3xl md:text-4xl font-bold tracking-tight text-ink mb-4">
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

export default SectionHeading;
