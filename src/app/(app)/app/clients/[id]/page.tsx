import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFirmRole } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { getClientById } from '@/lib/clients/queries';
import { ClientHeader } from '@/components/clients/ClientHeader';
import { DetailTabs } from '@/components/clients/DetailTabs';
import type { Client } from '@/lib/domain/tenancy';

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
    title: `${name} | GST Saathi`,
    description: `Manage GST compliance, documents, and returns for ${name}.`,
  };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireFirmRole('staff');

  const client = await getClientById(id);
  if (!client) {
    notFound();
  }

  // Fetch full record for deep attributes (turnover band, supply types, language)
  let rawRecord: unknown = null;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('firm_id', session.firm.id)
      .maybeSingle();
    rawRecord = data;
  } catch {
    // Supabase offline in dev
  }

  const { isDemoMode } = await import('@/lib/env');
  if (!rawRecord && isDemoMode) {
    const { getDevRawClientById } = await import('@/lib/auth/dev-mock');
    rawRecord = getDevRawClientById(id);
  }

  const isFirmAdmin = session.firm.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center text-sm font-medium text-muted hover:text-ink transition-colors min-h-[48px] py-2"
        >
          ← Back to all clients
        </Link>
      </div>

      <ClientHeader client={client} />

      <DetailTabs
        client={client}
        clientRecord={(rawRecord as unknown as Client) ?? null}
        isFirmAdmin={isFirmAdmin}
      />
    </div>
  );
}
