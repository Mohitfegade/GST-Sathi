import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFirmRole } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { updateClient } from '@/lib/clients/actions';
import { ClientFormFields } from '@/components/clients/ClientFormFields';
import { EditClientActions } from '@/components/clients/EditClientActions';
import type { ClientForm } from '@/lib/clients/types';
import type { Scheme, AatoBand, Lang } from '@/lib/domain/tenancy';

export const instant = false;

export const metadata: Metadata = {
  title: 'Edit Client | GST Saathi',
  description: 'Update business information or compliance settings.',
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireFirmRole('staff');

  let rawClient: unknown = null;
  try {
    const supabase = await createServerClient<Database>();
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('firm_id', session.firm.id)
      .maybeSingle();
    rawClient = data;
  } catch {
    // Supabase offline in dev
  }

  const { isDemoMode } = await import('@/lib/env');
  if (!rawClient && isDemoMode) {
    const { getDevRawClientById } = await import('@/lib/auth/dev-mock');
    rawClient = getDevRawClientById(id);
  }

  if (!rawClient) {
    notFound();
  }

  const client = rawClient as Database['public']['Tables']['clients']['Row'];

  const isArchived = Boolean(client.deleted_at);
  const isFirmAdmin = session.firm.role === 'admin';

  const initialValues: Partial<ClientForm> = {
    legal_name: client.legal_name,
    trade_name: client.trade_name || undefined,
    gstin: client.gstin,
    scheme: client.scheme as Scheme,
    aato_band: client.aato_band as AatoBand,
    sells_taxable: client.sells_taxable,
    sells_exempt: client.sells_exempt,
    language: client.language as Lang,
  };

  const updateWithId = updateClient.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/app/clients/${id}`}
          className="inline-flex items-center text-sm font-medium text-muted hover:text-ink transition-colors min-h-[48px] py-2"
        >
          ← Back to client details
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Edit client
            </h1>
            <p className="text-muted text-base mt-1">
              Update details for {client.trade_name || client.legal_name}.
            </p>
          </div>

          {isArchived && (
            <span className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
              Status: Hidden (Archived)
            </span>
          )}
        </div>
      </div>

      {isArchived && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink">
          <p className="font-semibold">This client is currently hidden.</p>
          <p className="text-muted mt-1">
            Their past documents and data are kept safely, but they do not appear in the active client list.
          </p>
        </div>
      )}

      {/* Main Edit Form */}
      <ClientFormFields
        initialValues={initialValues}
        clientId={id}
        submitAction={updateWithId}
        submitLabel="Save changes"
        cancelHref={`/app/clients/${id}`}
      />

      {/* Archive / Restore Section */}
      <section
        aria-label="Danger Zone"
        className="rounded-xl border border-line bg-surface/30 p-6 max-w-2xl space-y-4"
      >
        <h2 className="text-lg font-semibold text-ink">Client visibility</h2>
        <EditClientActions
          clientId={id}
          clientName={client.trade_name || client.legal_name}
          isArchived={isArchived}
          isFirmAdmin={isFirmAdmin}
        />
      </section>
    </div>
  );
}
