import React from 'react';

export interface ComingNextProps {
  title: string;
  description: string;
  scopeNotice?: string;
}

export function ComingNext({
  title,
  description,
  scopeNotice = 'This milestone focuses on client onboarding and owner access. Upload and tax processing features will connect here next.',
}: ComingNextProps) {
  return (
    <div className="rounded-xl border border-line bg-surface/50 p-8 text-center max-w-xl mx-auto my-8 space-y-4">
      <div className="inline-flex items-center justify-center rounded-full bg-surface border border-line px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Coming next
      </div>

      <h3 className="text-xl font-bold tracking-tight text-ink">
        {title}
      </h3>

      <p className="text-sm sm:text-base text-muted leading-relaxed">
        {description}
      </p>

      <p className="text-xs text-muted pt-2 border-t border-line">
        {scopeNotice}
      </p>
    </div>
  );
}

export default ComingNext;
