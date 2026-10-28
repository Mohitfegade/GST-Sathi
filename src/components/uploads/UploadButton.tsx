'use client';

import React, { useRef } from 'react';
import { ALLOWED_MIME_TYPES, MAX_FILES_PER_BATCH } from '@/lib/uploads/limits';

export interface UploadButtonProps {
  /** Callback fired when user selects one or more files */
  onFilesSelected: (files: File[]) => void;
  /** Whether the upload button is disabled */
  disabled?: boolean;
  /** Primary label text (default: 'Add bills') */
  label?: string;
  /** Maximum number of files permitted in a single selection (default: 20) */
  maxFiles?: number;
  /** Custom class names to merge onto the button element */
  className?: string;
  /** Custom accessible ARIA label */
  'aria-label'?: string;
  /** Optional callback when selected files exceed maxFiles */
  onMaxFilesExceeded?: (count: number, max: number) => void;
  /** Button style variant */
  variant?: 'primary' | 'secondary';
}

/**
 * UploadButton provides a large, accessible "Add bills" button.
 * Uses a hidden file input supporting JPEG, PNG, WebP, and PDF formats.
 * Prompts both camera and photo library/files on mobile devices (capture is not forced).
 * Enforces minimum 48px tap targets and zero hardcoded hex codes.
 */
export function UploadButton({
  onFilesSelected,
  disabled = false,
  label = 'Add bills',
  maxFiles = MAX_FILES_PER_BATCH,
  className = '',
  'aria-label': ariaLabel,
  onMaxFilesExceeded,
  variant = 'primary',
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled) return;
    // Trigger the hidden file input
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    let files = Array.from(fileList);

    if (files.length > maxFiles) {
      onMaxFilesExceeded?.(files.length, maxFiles);
      files = files.slice(0, maxFiles);
    }

    onFilesSelected(files);

    // Reset input value so selecting the same file again triggers onChange
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const baseStyles =
    'inline-flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] px-6 py-3 rounded-[8px] text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variantStyles =
    variant === 'secondary'
      ? 'bg-background text-ink border border-line hover:bg-surface active:bg-surface'
      : 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover';

  const combinedClasses = `${baseStyles} ${variantStyles} ${className}`.trim();

  const acceptString = ALLOWED_MIME_TYPES.join(',');

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptString}
        onChange={handleFileChange}
        disabled={disabled}
        tabIndex={-1}
        className="hidden"
        aria-hidden="true"
        data-testid="upload-file-input"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        aria-label={ariaLabel || label}
        className={combinedClasses}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{label}</span>
      </button>
    </>
  );
}

export default UploadButton;
