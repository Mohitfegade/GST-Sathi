import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/clients/SearchBar';
import { FilterChips } from '@/components/clients/FilterChips';
import { ClientTable } from '@/components/clients/ClientTable';
import { ClientCard } from '@/components/clients/ClientCard';
import { EmptyState } from '@/components/clients/EmptyState';
import { listClients } from '@/lib/clients/queries';
import type { ListFilters, ClientStatusLabel } from '@/lib/clients/types';
import type { Scheme } from '@/lib/domain/tenancy';

export const instant = false;

export const metadata: Metadata = {
  title: 'Clients | GST Saathi',
  description: 'Manage businesses you file GST returns for.',
};

interface ClientsPageProps {
  searchParams?: Promise<{
    search?: string;
    scheme?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};

  const search =
    typeof resolvedParams.search === 'string' && resolvedParams.search.trim()
      ? resolvedParams.search.trim()
      : undefined;

  const scheme =
    typeof resolvedParams.scheme === 'string' && resolvedParams.scheme !== 'all'
      ? (resolvedParams.scheme as Scheme)
      : undefined;

  const status =
    typeof resolvedParams.status === 'string' && resolvedParams.status !== 'all'
      ? (resolvedParams.status as ClientStatusLabel)
      : undefined;

  const parsedPage =
    typeof resolvedParams.page === 'string'
      ? parseInt(resolvedParams.page, 10)
      : 1;
  const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const hasActiveFilters = Boolean(search || scheme || status);

  const filters: ListFilters = {
    search,
    scheme: scheme || 'all',
    status: status || 'all',
    page: currentPage,
  };

  const { items, totalCount, totalPages } = await listClients(filters);

  // Helper to build pagination URLs while preserving current search & filters
  function buildPageUrl(pageNumber: number): string {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (scheme) params.set('scheme', scheme);
    if (status) params.set('status', status);
    if (pageNumber > 1) params.set('page', pageNumber.toString());

    const qs = params.toString();
    return qs ? `/app/clients?${qs}` : '/app/clients';
  }

  // 1. Unfiltered 0 total clients -> Render EmptyState
  if (!hasActiveFilters && totalCount === 0) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Clients
            </h1>
            <p className="mt-1 text-base text-muted sm:text-lg">
              Manage businesses you file GST returns for.
            </p>
          </div>
          <div>
            <Button href="/app/clients/new" variant="primary">
              Add client
            </Button>
          </div>
        </div>

        <EmptyState />
      </div>
    );
  }

  // 2. Filtered or non-empty state
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Clients
          </h1>
          <p className="mt-1 text-base text-muted sm:text-lg">
            Manage businesses you file GST returns for.
          </p>
        </div>
        <div>
          <Button href="/app/clients/new" variant="primary">
            Add client
          </Button>
        </div>
      </div>

      {/* Search and Filters Section */}
      <section
        aria-label="Filter and search clients"
        className="rounded-xl border border-line bg-surface p-4 sm:p-6 space-y-4"
      >
        <SearchBar initialValue={search ?? ''} />
        <FilterChips currentScheme={scheme ?? 'all'} currentStatus={status ?? 'all'} />
      </section>

      {/* Client Count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-muted">
          {totalCount === 1 ? '1 client' : `${totalCount} clients`}
        </p>
      </div>

      {/* Client List or Filter Empty State */}
      {items.length === 0 ? (
        <div
          role="region"
          aria-label="No matching clients"
          className="rounded-xl border border-line bg-surface p-8 text-center sm:p-12 space-y-4"
        >
          <p className="text-lg font-semibold text-ink sm:text-xl">
            No clients match your filter
          </p>
          <p className="text-sm text-muted max-w-md mx-auto">
            Try adjusting your search terms or clearing your selected filters.
          </p>
          <div className="pt-2">
            <Link
              href="/app/clients"
              className="min-h-[48px] inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-line bg-background text-sm font-medium text-ink hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block">
            <ClientTable clients={items} />
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="block md:hidden space-y-3">
            {items.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>

          {/* Simple Pagination Controls (Previous / Next / Page X of Y) */}
          {totalPages > 1 ? (
            <nav
              aria-label="Pagination navigation"
              className="flex items-center justify-between pt-6 border-t border-line"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildPageUrl(currentPage - 1)}
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-4 py-2 rounded-lg border border-line bg-surface text-ink text-sm font-medium hover:bg-background transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Previous
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-4 py-2 rounded-lg border border-line bg-surface text-muted text-sm font-medium opacity-50 cursor-not-allowed"
                >
                  Previous
                </span>
              )}

              <span className="text-sm font-medium text-ink">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={buildPageUrl(currentPage + 1)}
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-4 py-2 rounded-lg border border-line bg-surface text-ink text-sm font-medium hover:bg-background transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Next
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-4 py-2 rounded-lg border border-line bg-surface text-muted text-sm font-medium opacity-50 cursor-not-allowed"
                >
                  Next
                </span>
              )}
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
