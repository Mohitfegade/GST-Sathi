import React from 'react';
import { Button } from '@/components/ui/Button';

export interface EmptyStateProps {
  className?: string;
}

export function EmptyState({ className = '' }: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="Add your first client"
      className={`rounded-xl border border-line bg-surface p-8 text-center sm:p-12 ${className}`.trim()}
    >
      <div className="mx-auto max-w-lg space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Add your first client
        </h2>
        <p className="text-base text-ink sm:text-lg">
          Add a business you file GST for. Once added, you can invite the shop owner to share their bills.
        </p>
        <div className="pt-2">
          <Button href="/app/clients/new" variant="primary">
            Add client
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
