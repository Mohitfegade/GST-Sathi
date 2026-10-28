'use client';

import React, { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CLIENT_STATUS_LABELS, type ClientStatusLabel } from '@/lib/clients/types';
import type { Scheme } from '@/lib/domain/tenancy';

export interface FilterChipsProps {
  currentScheme?: string;
  currentStatus?: string;
  className?: string;
}

interface SchemeOption {
  value: Scheme | 'all';
  label: string;
}

interface StatusOption {
  value: ClientStatusLabel | 'all';
  label: string;
}

const SCHEME_OPTIONS: SchemeOption[] = [
  { value: 'all', label: 'All schemes' },
  { value: 'regular', label: 'Regular' },
  { value: 'qrmp', label: 'QRMP' },
  { value: 'composition', label: 'Composition' },
];

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'All status' },
  ...CLIENT_STATUS_LABELS.map((status) => ({
    value: status,
    label: status,
  })),
];

export function FilterChips({
  currentScheme,
  currentStatus,
  className = '',
}: FilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeScheme = currentScheme || searchParams.get('scheme') || 'all';
  const activeStatus = currentStatus || searchParams.get('status') || 'all';

  function updateFilter(key: 'scheme' | 'status', value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    // Reset pagination to page 1 whenever filters change
    params.delete('page');

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  }

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {/* Scheme Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted sm:w-20">
          Scheme:
        </span>
        <div
          role="group"
          aria-label="Filter by tax scheme"
          className="flex flex-wrap items-center gap-2"
        >
          {SCHEME_OPTIONS.map((opt) => {
            const isSelected = activeScheme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFilter('scheme', opt.value)}
                aria-pressed={isSelected}
                className={`min-h-[48px] px-4 py-2.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'bg-accent text-on-accent border border-accent shadow-sm'
                    : 'bg-surface text-ink border border-line hover:border-ink hover:bg-background'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted sm:w-20">
          Status:
        </span>
        <div
          role="group"
          aria-label="Filter by compliance status"
          className="flex flex-wrap items-center gap-2"
        >
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = activeStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFilter('status', opt.value)}
                aria-pressed={isSelected}
                className={`min-h-[48px] px-4 py-2.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'bg-accent text-on-accent border border-accent shadow-sm'
                    : 'bg-surface text-ink border border-line hover:border-ink hover:bg-background'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FilterChips;
