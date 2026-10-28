'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  initialValue = '',
  placeholder = 'Search by business name, trade name, or GSTIN...',
  className = '',
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentParam = searchParams.get('search') ?? '';
  const [prevParam, setPrevParam] = useState(currentParam);
  const [query, setQuery] = useState(initialValue || currentParam);

  // Sync internal state if URL param changes externally
  if (currentParam !== prevParam) {
    setPrevParam(currentParam);
    setQuery(currentParam);
  }

  // Debounced update to the URL
  useEffect(() => {
    const param = searchParams.get('search') ?? '';
    if (query === param) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = query.trim();

      if (trimmed) {
        params.set('search', trimmed);
      } else {
        params.delete('search');
      }

      // Reset pagination on search change
      params.delete('page');

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, pathname, router, searchParams]);

  function applySearch(newQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = newQuery.trim();

    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }

    // Reset pagination on search change
    params.delete('page');

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    applySearch(query);
  }

  function handleClear() {
    setQuery('');
    applySearch('');
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`relative w-full ${className}`.trim()}
    >
      <label htmlFor="client-search-input" className="sr-only">
        Search clients
      </label>
      <div className="relative flex items-center">
        <input
          id="client-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search clients by legal name, trade name, or GSTIN"
          className="w-full min-h-[48px] rounded-lg border border-line bg-background px-4 py-2.5 pr-20 text-base text-ink placeholder:text-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />

        <div className="absolute right-1 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search text"
              className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-md text-sm font-medium text-muted hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Clear
            </button>
          ) : null}

          {isPending ? (
            <span
              aria-hidden="true"
              className="pr-3 text-xs font-medium text-muted"
            >
              Searching...
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export default SearchBar;
