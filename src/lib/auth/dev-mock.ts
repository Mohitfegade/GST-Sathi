import type { SessionContext } from './types';
import type {
  ClientListItem,
  ListFilters,
  PaginatedClients,
  ClientStatusLabel,
} from '@/lib/clients/types';
import { getStateName } from '@/lib/gst/state-codes';

export const DEV_MOCK_SESSION: SessionContext = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    app_metadata: {},
    user_metadata: { name: 'Demo CA' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email: 'ca.demo@gstsaathi.in',
    phone: '',
    role: 'authenticated',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as SessionContext['user'],
  firm: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Sharma & Associates CA Firm [Demo]',
    role: 'admin',
  },
  clients: [
    {
      id: 'c1000000-0000-4000-a000-000000000001',
      name: 'Sharma General Stores',
      role: 'owner',
    },
    {
      id: 'c1000000-0000-4000-a000-000000000002',
      name: 'Patil Hardware Mart',
      role: 'owner',
    },
    {
      id: 'c1000000-0000-4000-a000-000000000003',
      name: 'Patel Provision & Kirana',
      role: 'owner',
    },
  ],
  home: '/app',
};

export interface RawDevClient {
  id: string;
  firm_id?: string;
  legal_name: string;
  trade_name: string;
  gstin: string;
  state_code: string;
  scheme: 'regular' | 'composition' | 'qrmp';
  aato_band: string;
  fy_start_month: number;
  language: string;
  sells_exempt: boolean;
  sells_taxable: boolean;
  is_fixture?: boolean;
  notes?: string;
  deleted_at?: string | null;
  created_at?: string;
}

export const RAW_DEV_CLIENTS: RawDevClient[] = [
  {
    id: 'c1000000-0000-4000-a000-000000000001',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Sharma General Stores Proprietary Concern',
    trade_name: 'Sharma General Stores',
    gstin: '27FAKES1234A1ZJ',
    state_code: '27',
    scheme: 'regular',
    aato_band: '40l_to_1_5cr',
    fy_start_month: 4,
    language: 'mr',
    sells_exempt: true,
    sells_taxable: true,
    notes: 'Retail neighborhood grocery and daily FMCG essentials in Pune, Maharashtra.',
    created_at: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000002',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Patil Hardware & Electricals Enterprises',
    trade_name: 'Patil Hardware Mart',
    gstin: '27FAKEP5678B1ZW',
    state_code: '27',
    scheme: 'composition',
    aato_band: 'below_40l',
    fy_start_month: 4,
    language: 'mr',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Retail electrical fixtures and plumbing fittings store in Kolhapur, Maharashtra.',
    created_at: '2026-01-15T11:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000003',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Patel Provision Stores LLP',
    trade_name: 'Patel Provision & Kirana',
    gstin: '24FAKET9012C1ZC',
    state_code: '24',
    scheme: 'qrmp',
    aato_band: 'below_40l',
    fy_start_month: 4,
    language: 'hi',
    sells_exempt: true,
    sells_taxable: true,
    notes: 'Quarterly return retail grocery and dairy shop in Ahmedabad, Gujarat.',
    created_at: '2026-01-20T09:30:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000004',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Mehta Fabrics & Textile Traders',
    trade_name: 'Mehta Textile Wholesale',
    gstin: '24FAKEM3456D1ZD',
    state_code: '24',
    scheme: 'regular',
    aato_band: '1_5cr_to_5cr',
    fy_start_month: 4,
    language: 'en',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Wholesale synthetic and cotton fabric trader in Surat textile market, Gujarat.',
    created_at: '2026-01-22T14:15:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000005',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Gupta Electronics & Mobiles Private Limited',
    trade_name: 'Gupta Electronics Hub',
    gstin: '07FAKEG7890E1ZZ',
    state_code: '07',
    scheme: 'regular',
    aato_band: '1_5cr_to_5cr',
    fy_start_month: 4,
    language: 'hi',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Consumer electronics and mobile accessories retailer in Nehru Place, Delhi.',
    created_at: '2026-01-25T16:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000006',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Aggarwal Sweets & Namkeen Corner',
    trade_name: 'Aggarwal Sweet Mart',
    gstin: '07FAKEA1234F1ZT',
    state_code: '07',
    scheme: 'composition',
    aato_band: 'below_40l',
    fy_start_month: 4,
    language: 'hi',
    sells_exempt: true,
    sells_taxable: true,
    notes: 'Traditional sweet shop and quick service snacks stall in Chandni Chowk, Delhi.',
    created_at: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000007',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Rao Automotive & Spares Corporation',
    trade_name: 'Rao Auto Spares',
    gstin: '29FAKER5678G1ZG',
    state_code: '29',
    scheme: 'regular',
    aato_band: '40l_to_1_5cr',
    fy_start_month: 4,
    language: 'en',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Automotive spare parts and lubricants distributor in Bengaluru, Karnataka.',
    created_at: '2026-02-05T15:30:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000008',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Gowda Dairy & Agro Products',
    trade_name: 'Gowda Fresh Dairy & Essentials',
    gstin: '29FAKED9012H1Z8',
    state_code: '29',
    scheme: 'qrmp',
    aato_band: 'below_40l',
    fy_start_month: 4,
    language: 'en',
    sells_exempt: true,
    sells_taxable: false,
    notes: 'Fresh milk, unprocessed farm dairy, and agro staples retailer in Mysuru, Karnataka.',
    created_at: '2026-02-10T08:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000009',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Murugan Footwear & Leather Mart',
    trade_name: 'Murugan Footwear Mart',
    gstin: '33FAKEM3456J1Z1',
    state_code: '33',
    scheme: 'regular',
    aato_band: 'below_40l',
    fy_start_month: 4,
    language: 'en',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Retail footwear, slippers, and leather accessories shop in T. Nagar, Chennai, Tamil Nadu.',
    created_at: '2026-02-14T10:45:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000010',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Sundaram Stationery & Paper Products',
    trade_name: 'Sundaram Stationery & Printers',
    gstin: '33FAKES7890K1ZF',
    state_code: '33',
    scheme: 'qrmp',
    aato_band: '40l_to_1_5cr',
    fy_start_month: 4,
    language: 'en',
    sells_exempt: true,
    sells_taxable: true,
    notes: 'Commercial stationery supplier and book distributor in Coimbatore, Tamil Nadu.',
    created_at: '2026-02-18T13:20:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000011',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Marwar Trading & Spices Company',
    trade_name: 'Marwar Spices & Grain Wholesale',
    gstin: '08FAKEM1234L1Z2',
    state_code: '08',
    scheme: 'regular',
    aato_band: '1_5cr_to_5cr',
    fy_start_month: 4,
    language: 'hi',
    sells_exempt: true,
    sells_taxable: true,
    notes: 'B2B wholesale merchant of whole spices, pulses, and grains in Jodhpur, Rajasthan.',
    created_at: '2026-02-22T17:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000012',
    firm_id: '11111111-1111-4111-8111-111111111111',
    legal_name: 'Khandelwal Building Solutions & Hardware',
    trade_name: 'Khandelwal Sanitary & Tiles',
    gstin: '08FAKEK5678M1ZE',
    state_code: '08',
    scheme: 'composition',
    aato_band: '40l_to_1_5cr',
    fy_start_month: 4,
    language: 'hi',
    sells_exempt: false,
    sells_taxable: true,
    notes: 'Sanitaryware, plumbing fittings, and ceramic tiles showroom in Jaipur, Rajasthan.',
    created_at: '2026-02-28T11:15:00.000Z',
  },
];

const STATUS_LABELS: ClientStatusLabel[] = [
  'Documents waiting',
  'Ready for review',
  'Filed',
  'Needs attention',
  'No activity yet',
];

export function getDevClientListItems(): ClientListItem[] {
  return RAW_DEV_CLIENTS.map((c, index) => {
    const status_label = STATUS_LABELS[index % STATUS_LABELS.length];
    const owner_access_state =
      index === 0 ? 'active' : index % 2 === 0 ? 'invited' : 'none';

    return {
      id: c.id,
      names: {
        legal_name: c.legal_name,
        trade_name: c.trade_name,
      },
      gstin: c.gstin,
      state_name: getStateName(c.state_code) || 'Maharashtra',
      scheme: c.scheme,
      status_label,
      owner_access_state,
      deleted_at: null,
      created_at: c.created_at,
    };
  });
}

export function queryDevClients(filters: ListFilters = {}): PaginatedClients {
  let items = getDevClientListItems();

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.names.legal_name.toLowerCase().includes(q) ||
        (c.names.trade_name && c.names.trade_name.toLowerCase().includes(q)) ||
        c.gstin.toLowerCase().includes(q)
    );
  }

  if (filters.scheme && filters.scheme !== 'all') {
    items = items.filter((c) => c.scheme === filters.scheme);
  }

  if (filters.status && filters.status !== 'all') {
    items = items.filter((c) => c.status_label === filters.status);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 25;
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const start = (page - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);

  return {
    items: pagedItems,
    totalCount,
    currentPage: page,
    pageSize,
    totalPages,
  };
}

export function getDevClientById(id: string): ClientListItem | null {
  const items = getDevClientListItems();
  return items.find((c) => c.id === id) || null;
}

export function getDevRawClientById(id: string): RawDevClient | null {
  return RAW_DEV_CLIENTS.find((c) => c.id === id) || null;
}
