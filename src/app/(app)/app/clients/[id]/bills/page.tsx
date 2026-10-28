import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFirmRole } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { getClientById } from '@/lib/clients/queries';
import { listDocuments, getDocumentStatusCounts, createPreviewUrl } from '@/lib/uploads/queries';
import { ClientHeader } from '@/components/clients/ClientHeader';
import { DetailTabs } from '@/components/clients/DetailTabs';
import { UploadPanel } from '@/components/uploads/UploadPanel';
import { DocumentList } from '@/components/uploads/DocumentList';
import type { Client } from '@/lib/domain/tenancy';
import type { DocStatus } from '@/lib/uploads/types';

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await getClientById(id);
  const name = client?.names.trade_name || client?.names.legal_name || 'Client';

  return {
    title: `Purchase Bills – ${name} | GST Saathi`,
    description: `Manage and upload purchase bills for ${name}.`,
  };
}

export default async function ClientBillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; month?: string; page?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  // 1. Verify staff session
  const session = await requireFirmRole('staff');

  // 2. Fetch client details
  const client = await getClientById(id);
  if (!client) {
    notFound();
  }

  // Fetch full client record for deep tenancy attributes
  const supabase = await createServerClient();
  const { data: rawRecord } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('firm_id', session.firm.id)
    .maybeSingle();

  const isFirmAdmin = session.firm.role === 'admin';

  // 3. Resolve filters & fetch documents and status counts
  const rawStatus = resolvedSearchParams?.status;
  const filterStatus: DocStatus | 'all' =
    rawStatus && rawStatus !== 'all' ? (rawStatus as DocStatus) : 'all';
  const filterMonth = resolvedSearchParams?.month || 'all';
  const pageNumber = resolvedSearchParams?.page
    ? parseInt(resolvedSearchParams.page, 10)
    : 1;

  const [paginatedDocs, statusCounts] = await Promise.all([
    listDocuments(id, {
      status: filterStatus !== 'all' ? filterStatus : undefined,
      periodFp: filterMonth !== 'all' ? filterMonth : undefined,
      page: pageNumber,
      pageSize: 100,
    }),
    getDocumentStatusCounts(id),
  ]);

  // Server action for generating 5-minute signed preview URLs
  async function handleCreatePreviewUrl(storagePath: string): Promise<string | null> {
    'use server';
    return createPreviewUrl(storagePath);
  }

  const clientDisplayName = client.names.trade_name || client.names.legal_name;

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation linking back to client overview */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link
          href="/app/clients"
          className="hover:text-ink transition-colors min-h-[48px] inline-flex items-center py-2"
        >
          Clients
        </Link>
        <span aria-hidden="true" className="text-line">/</span>
        <Link
          href={`/app/clients/${client.id}`}
          className="hover:text-ink transition-colors min-h-[48px] inline-flex items-center py-2"
        >
          {clientDisplayName}
        </Link>
        <span aria-hidden="true" className="text-line">/</span>
        <span className="text-ink font-semibold" aria-current="page">
          Bills
        </span>
      </nav>

      {/* Back button */}
      <div>
        <Link
          href={`/app/clients/${client.id}`}
          className="inline-flex items-center text-sm font-medium text-muted hover:text-ink transition-colors min-h-[48px] py-2"
        >
          ← Back to {clientDisplayName} overview
        </Link>
      </div>

      {/* Client Header (Client name, trade name, GSTIN, State, Scheme, Compliance status) */}
      <ClientHeader client={client} />

      {/* DetailTabs with Bills active, allowing seamless back-navigation to Overview */}
      <DetailTabs
        client={client}
        clientRecord={(rawRecord as unknown as Client) ?? null}
        isFirmAdmin={isFirmAdmin}
        initialTab="bills"
      >
        <div className="space-y-8 pt-2">
          {/* Section: Upload Panel */}
          <section aria-label="Upload purchase bills">
            <UploadPanel clientId={id} role="accountant" />
          </section>

          {/* Section: Purchase Bills List & Filters */}
          <section aria-label="Purchase bills list">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b border-line pb-4">
                <div>
                  <h2 className="text-xl font-bold text-ink">
                    Bills received
                  </h2>
                  <p className="text-sm text-muted mt-0.5">
                    View, filter, and inspect purchase bills sent for this client.
                  </p>
                </div>
                <p className="text-sm font-medium text-muted">
                  {statusCounts.total === 1
                    ? '1 total bill'
                    : `${statusCounts.total} total bills`}
                </p>
              </div>

              <DocumentList
                clientId={id}
                initialDocuments={paginatedDocs.items}
                statusCounts={statusCounts}
                initialStatus={filterStatus}
                initialMonth={filterMonth}
                onPreviewUrl={handleCreatePreviewUrl}
              />
            </div>
          </section>
        </div>
      </DetailTabs>
    </div>
  );
}
