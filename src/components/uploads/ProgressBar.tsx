'use client';

import React from 'react';

export interface ProgressBarProps {
  /** Current progress percentage from 0 to 100 */
  progress: number;
  /** Optional accessible label for screen readers */
  label?: string;
  /** Whether to visually render the percentage text */
  showLabel?: boolean;
  /** Additional custom class names for the outer container */
  className?: string;
  /** Custom accessible ARIA label */
  'aria-label'?: string;
}

/**
 * Accessible progress bar adhering to design tokens.
 * Uses bg-surface track, border border-line, and bg-accent fill.
 * WCAG accessible with role="progressbar" and appropriate ARIA attributes.
 */
export function ProgressBar({
  progress,
  label = 'Upload progress',
  showLabel = false,
  className = '',
  'aria-label': ariaLabel,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={`w-full ${className}`.trim()}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-xs text-muted font-medium">
          <span>{label}</span>
          <span aria-hidden="true">{clampedProgress}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || label}
        className="w-full h-2 rounded-full bg-surface border border-line overflow-hidden"
      >
        <div
          className="h-full bg-accent transition-all duration-200 ease-out rounded-full"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
