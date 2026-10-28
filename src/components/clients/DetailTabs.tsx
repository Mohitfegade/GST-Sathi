'use client';

import React, { useState } from 'react';
import { ComingNext } from '@/components/clients/ComingNext';
import { OwnerAccess } from '@/components/clients/OwnerAccess';
import type { ClientListItem } from '@/lib/clients/types';
import type { Client } from '@/lib/domain/tenancy';

export type ClientTabId = 'overview' | 'bills' | 'gstr2b' | 'returns';

export interface DetailTabsProps {
  client: ClientListItem;
  clientRecord?: Client | null;
  isFirmAdmin: boolean;
}

interface TabOption {
  id: ClientTabId;
  label: string;
}

const TABS: TabOption[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bills', label: 'Bills' },
  { id: 'gstr2b', label: 'GSTR-2B' },
  { id: 'returns', label: 'Returns' },
];

export function DetailTabs({
  client,
  clientRecord,
  isFirmAdmin,
}: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<ClientTabId>('overview');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <nav
        aria-label="Client sections"
        role="tablist"
        className="flex items-center gap-2 border-b border-line overflow-x-auto pb-px"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 min-h-[48px] ${
                isActive
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:text-ink hover:border-line'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <div
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
            className="space-y-8"
          >
            {/* Overview Details Grid */}
            <section
              aria-label="Business overview"
              className="rounded-xl border border-line bg-surface/30 p-6 space-y-6"
            >
              <h2 className="text-lg font-semibold text-ink">
                Business details
              </h2>

              <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Legal Name</dt>
                  <dd className="mt-1 font-medium text-ink">{client.names.legal_name}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Trade Name</dt>
                  <dd className="mt-1 font-medium text-ink">{client.names.trade_name || '—'}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">GSTIN</dt>
                  <dd className="mt-1 font-mono font-medium text-ink">{client.gstin}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">State</dt>
                  <dd className="mt-1 font-medium text-ink">{client.state_name}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">GST Scheme</dt>
                  <dd className="mt-1 font-medium capitalize text-ink">{client.scheme}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Turnover Band</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {clientRecord?.aato_band === 'below_40l' && 'Below ₹40 Lakhs'}
                    {clientRecord?.aato_band === '40l_to_1_5cr' && '₹40 Lakhs to ₹1.5 Crore'}
                    {clientRecord?.aato_band === '1_5cr_to_5cr' && '₹1.5 Crore to ₹5 Crore'}
                    {clientRecord?.aato_band === 'above_5cr' && 'Above ₹5 Crore'}
                    {!clientRecord?.aato_band && '—'}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Supplies</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {clientRecord?.sells_taxable && clientRecord?.sells_exempt && 'Taxable and exempt goods'}
                    {clientRecord?.sells_taxable && !clientRecord?.sells_exempt && 'Taxable goods only'}
                    {!clientRecord?.sells_taxable && clientRecord?.sells_exempt && 'Exempt goods only'}
                    {!clientRecord && '—'}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Preferred Language</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {clientRecord?.language === 'en' && 'English'}
                    {clientRecord?.language === 'hi' && 'Hindi (हिंदी)'}
                    {clientRecord?.language === 'mr' && 'Marathi (मराठी)'}
                    {!clientRecord?.language && 'English'}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Compliance Status</dt>
                  <dd className="mt-1 font-medium text-ink">{client.status_label}</dd>
                </div>
              </dl>
            </section>

            {/* Owner Access Section */}
            <section aria-label="Shop owner access">
              <OwnerAccess clientId={client.id} isFirmAdmin={isFirmAdmin} />
            </section>
          </div>
        )}

        {activeTab === 'bills' && (
          <div role="tabpanel" id="tabpanel-bills" aria-labelledby="tab-bills">
            <ComingNext
              title="Purchase and sales bills"
              description="Upload PDF and photo bills from shop owners, extract line items, and organize vouchers for the return period."
            />
          </div>
        )}

        {activeTab === 'gstr2b' && (
          <div role="tabpanel" id="tabpanel-gstr2b" aria-labelledby="tab-gstr2b">
            <ComingNext
              title="Government GSTR-2B reconciliation"
              description="Import monthly GSTR-2B JSON and Excel data from the GST portal and automatically match against purchase bills."
            />
          </div>
        )}

        {activeTab === 'returns' && (
          <div role="tabpanel" id="tabpanel-returns" aria-labelledby="tab-returns">
            <ComingNext
              title="Draft GSTR-1 and GSTR-3B returns"
              description="Review auto-drafted returns, preview tax liabilities and input tax credit, and export JSON for human portal filing."
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailTabs;
