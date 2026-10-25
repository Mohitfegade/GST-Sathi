#!/usr/bin/env node

/**
 * seed-fixtures.mjs
 * 
 * FAKE DATA FOR LOCAL TESTING ONLY - NOT REAL ENTITIES OR TAX DATA.
 * 
 * Reads fake tenant & transactional fixtures from `supabase/fixtures/fake-tenants.json`
 * and inserts them via the Supabase client or generates raw SQL statements.
 * 
 * Usage:
 *   node scripts/seed-fixtures.mjs          # Insert via Supabase client (requires running Supabase instance)
 *   node scripts/seed-fixtures.mjs --sql    # Print SQL statements to stdout
 *   node scripts/seed-fixtures.mjs --output seed.sql # Write SQL statements to a file
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local or .env if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const FIXTURES_PATH = path.resolve(rootDir, 'supabase', 'fixtures', 'fake-tenants.json');

function loadFixtures() {
  if (!fs.existsSync(FIXTURES_PATH)) {
    throw new Error(`Fixtures file not found at ${FIXTURES_PATH}`);
  }
  const raw = fs.readFileSync(FIXTURES_PATH, 'utf8');
  return JSON.parse(raw);
}

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSql(fixtures) {
  const lines = [
    '--',
    '-- FAKE DATA FOR LOCAL TESTING ONLY - NOT REAL ENTITIES OR TAX DATA',
    '-- Generated from supabase/fixtures/fake-tenants.json',
    '--',
    'BEGIN;',
    '',
    '-- 0. Ensure mock auth users exist in auth.users if auth schema is present',
    'DO $$',
    'BEGIN',
    "  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN",
    '    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)',
    '    VALUES',
    "      ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin1@fake-tax.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now()),",
    "      ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'staff1@fake-tax.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now()),",
    "      ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin2@fake-apex.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now()),",
    "      ('00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'owner1@fake-ganesh.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now()),",
    "      ('00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'owner2@fake-vidyarthi.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now()),",
    "      ('00000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'owner3@fake-saikrupa.example.com', '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now())",
    '    ON CONFLICT (id) DO NOTHING;',
    '  END IF;',
    'END $$;',
    ''
  ];

  // Map client_id -> firm_id
  const clientFirmMap = new Map();
  if (fixtures.clients?.length) {
    for (const c of fixtures.clients) {
      clientFirmMap.set(c.id, c.firm_id);
    }
  }

  // 1. Firms
  if (fixtures.firms?.length) {
    lines.push('-- 1. Insert Firms & Firm Members');
    for (const firm of fixtures.firms) {
      lines.push(
        `INSERT INTO public.firms (id, name, created_by) ` +
        `VALUES (${escapeSqlValue(firm.id)}, ${escapeSqlValue(firm.name)}, ${escapeSqlValue(firm.created_by)}) ` +
        `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_by = EXCLUDED.created_by;`
      );

      // Firm members
      if (firm.members?.length) {
        for (const member of firm.members) {
          lines.push(
            `INSERT INTO public.firm_members (firm_id, user_id, role) ` +
            `VALUES (${escapeSqlValue(member.firm_id || firm.id)}, ${escapeSqlValue(member.user_id)}, ${escapeSqlValue(member.role)}) ` +
            `ON CONFLICT (firm_id, user_id) DO UPDATE SET role = EXCLUDED.role;`
          );
        }
      }
    }
    lines.push('');
  }

  // 2. Clients
  if (fixtures.clients?.length) {
    lines.push('-- 2. Insert Clients & Client Access');
    for (const client of fixtures.clients) {
      lines.push(
        `INSERT INTO public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band, fy_start_month, language, sells_exempt, sells_taxable) ` +
        `VALUES (${escapeSqlValue(client.id)}, ${escapeSqlValue(client.firm_id)}, ${escapeSqlValue(client.legal_name)}, ${escapeSqlValue(client.trade_name)}, ${escapeSqlValue(client.gstin)}, ${escapeSqlValue(client.state_code)}, ${escapeSqlValue(client.scheme)}, ${escapeSqlValue(client.aato_band)}, ${escapeSqlValue(client.fy_start_month ?? 4)}, ${escapeSqlValue(client.language ?? 'en')}, ${escapeSqlValue(client.sells_exempt ?? false)}, ${escapeSqlValue(client.sells_taxable ?? true)}) ` +
        `ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name, trade_name = EXCLUDED.trade_name, gstin = EXCLUDED.gstin, state_code = EXCLUDED.state_code, scheme = EXCLUDED.scheme, aato_band = EXCLUDED.aato_band, fy_start_month = EXCLUDED.fy_start_month, language = EXCLUDED.language, sells_exempt = EXCLUDED.sells_exempt, sells_taxable = EXCLUDED.sells_taxable;`
      );

      if (client.access?.length) {
        for (const acc of client.access) {
          lines.push(
            `INSERT INTO public.client_access (firm_id, client_id, user_id, role) ` +
            `VALUES (${escapeSqlValue(acc.firm_id || client.firm_id)}, ${escapeSqlValue(acc.client_id || client.id)}, ${escapeSqlValue(acc.user_id)}, ${escapeSqlValue(acc.role)}) ` +
            `ON CONFLICT (client_id, user_id) DO UPDATE SET role = EXCLUDED.role;`
          );
        }
      }
    }
    lines.push('');
  }

  // 3. Suppliers
  if (fixtures.suppliers?.length) {
    lines.push('-- 3. Insert Suppliers');
    for (const sup of fixtures.suppliers) {
      lines.push(
        `INSERT INTO public.suppliers (id, firm_id, client_id, gstin, name, filing_status, last_checked_at, notes) ` +
        `VALUES (${escapeSqlValue(sup.id)}, ${escapeSqlValue(sup.firm_id)}, ${escapeSqlValue(sup.client_id)}, ${escapeSqlValue(sup.gstin)}, ${escapeSqlValue(sup.name)}, ${escapeSqlValue(sup.filing_status)}, ${escapeSqlValue(sup.last_checked_at)}, ${escapeSqlValue(sup.notes)}) ` +
        `ON CONFLICT (id) DO UPDATE SET gstin = EXCLUDED.gstin, name = EXCLUDED.name, filing_status = EXCLUDED.filing_status, last_checked_at = EXCLUDED.last_checked_at, notes = EXCLUDED.notes;`
      );
    }
    lines.push('');
  }

  // 4. Documents
  if (fixtures.documents?.length) {
    lines.push('-- 4. Insert Documents');
    for (const doc of fixtures.documents) {
      lines.push(
        `INSERT INTO public.documents (id, firm_id, client_id, kind, storage_path, original_name, mime_type, size_bytes, sha256, status, uploaded_by, period_fp) ` +
        `VALUES (${escapeSqlValue(doc.id)}, ${escapeSqlValue(doc.firm_id)}, ${escapeSqlValue(doc.client_id)}, ${escapeSqlValue(doc.kind)}, ${escapeSqlValue(doc.storage_path)}, ${escapeSqlValue(doc.original_name)}, ${escapeSqlValue(doc.mime_type)}, ${escapeSqlValue(doc.size_bytes)}, ${escapeSqlValue(doc.sha256)}, ${escapeSqlValue(doc.status)}, ${escapeSqlValue(doc.uploaded_by)}, ${escapeSqlValue(doc.period_fp)}) ` +
        `ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, storage_path = EXCLUDED.storage_path, original_name = EXCLUDED.original_name, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256, status = EXCLUDED.status, period_fp = EXCLUDED.period_fp;`
      );
    }
    lines.push('');
  }

  // 5. Invoices
  if (fixtures.invoices?.length) {
    lines.push('-- 5. Insert Invoices');
    for (const inv of fixtures.invoices) {
      lines.push(
        `INSERT INTO public.invoices (id, firm_id, client_id, supplier_id, document_id, invoice_no, invoice_no_norm, invoice_date, place_of_supply, taxable_value, cgst, sgst, igst, cess, round_off, total, status, source, itc_state, period_fp) ` +
        `VALUES (${escapeSqlValue(inv.id)}, ${escapeSqlValue(inv.firm_id)}, ${escapeSqlValue(inv.client_id)}, ${escapeSqlValue(inv.supplier_id)}, ${escapeSqlValue(inv.document_id)}, ${escapeSqlValue(inv.invoice_no)}, ${escapeSqlValue(inv.invoice_no_norm)}, ${escapeSqlValue(inv.invoice_date)}, ${escapeSqlValue(inv.place_of_supply)}, ${escapeSqlValue(inv.taxable_value)}, ${escapeSqlValue(inv.cgst)}, ${escapeSqlValue(inv.sgst)}, ${escapeSqlValue(inv.igst)}, ${escapeSqlValue(inv.cess)}, ${escapeSqlValue(inv.round_off)}, ${escapeSqlValue(inv.total)}, ${escapeSqlValue(inv.status)}, ${escapeSqlValue(inv.source)}, ${escapeSqlValue(inv.itc_state)}, ${escapeSqlValue(inv.period_fp)}) ` +
        `ON CONFLICT (id) DO UPDATE SET invoice_no = EXCLUDED.invoice_no, invoice_no_norm = EXCLUDED.invoice_no_norm, invoice_date = EXCLUDED.invoice_date, place_of_supply = EXCLUDED.place_of_supply, taxable_value = EXCLUDED.taxable_value, cgst = EXCLUDED.cgst, sgst = EXCLUDED.sgst, igst = EXCLUDED.igst, cess = EXCLUDED.cess, total = EXCLUDED.total, status = EXCLUDED.status, source = EXCLUDED.source, itc_state = EXCLUDED.itc_state, period_fp = EXCLUDED.period_fp;`
      );
    }
    lines.push('');
  }

  // 6. Sales entries
  if (fixtures.sales_entries?.length) {
    lines.push('-- 6. Insert Sales Entries');
    for (const sale of fixtures.sales_entries) {
      const firmId = sale.firm_id || clientFirmMap.get(sale.client_id);
      lines.push(
        `INSERT INTO public.sales_entries (id, firm_id, client_id, entry_date, cash_total, upi_total, taxable_sales, exempt_sales, source, document_id) ` +
        `VALUES (${escapeSqlValue(sale.id)}, ${escapeSqlValue(firmId)}, ${escapeSqlValue(sale.client_id)}, ${escapeSqlValue(sale.entry_date)}, ${escapeSqlValue(sale.cash_total)}, ${escapeSqlValue(sale.upi_total)}, ${escapeSqlValue(sale.taxable_sales)}, ${escapeSqlValue(sale.exempt_sales)}, ${escapeSqlValue(sale.source)}, ${escapeSqlValue(sale.document_id)}) ` +
        `ON CONFLICT (id) DO UPDATE SET entry_date = EXCLUDED.entry_date, cash_total = EXCLUDED.cash_total, upi_total = EXCLUDED.upi_total, taxable_sales = EXCLUDED.taxable_sales, exempt_sales = EXCLUDED.exempt_sales, source = EXCLUDED.source, document_id = EXCLUDED.document_id;`
      );
    }
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

async function seedViaSupabase(fixtures) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    console.error('ERROR: No Supabase API key provided.');
    console.error('Please set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment,');
    console.error('or run with --sql to generate SQL statements instead:');
    console.error('  node scripts/seed-fixtures.mjs --sql');
    process.exit(1);
  }

  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('Seeding fake fixture data (FOR LOCAL TESTING ONLY)...');

  // Client to Firm map for denormalized firm_id references
  const clientFirmMap = new Map();
  if (fixtures.clients?.length) {
    for (const c of fixtures.clients) {
      clientFirmMap.set(c.id, c.firm_id);
    }
  }

  // 1. Firms
  if (fixtures.firms?.length) {
    console.log(`- Upserting ${fixtures.firms.length} fake firms...`);
    for (const firm of fixtures.firms) {
      const { error: firmErr } = await supabase
        .from('firms')
        .upsert({ id: firm.id, name: firm.name, created_by: firm.created_by });
      if (firmErr) {
        console.warn(`  Warning upserting firm "${firm.name}":`, firmErr.message);
      }

      if (firm.members?.length) {
        for (const member of firm.members) {
          const { error: memErr } = await supabase
            .from('firm_members')
            .upsert({
              firm_id: member.firm_id || firm.id,
              user_id: member.user_id,
              role: member.role
            });
          if (memErr) {
            console.warn(`  Warning upserting firm member ${member.user_id}:`, memErr.message);
          }
        }
      }
    }
  }

  // 2. Clients
  if (fixtures.clients?.length) {
    console.log(`- Upserting ${fixtures.clients.length} fake clients...`);
    for (const client of fixtures.clients) {
      const { access, ...clientData } = client;
      const { error: clientErr } = await supabase
        .from('clients')
        .upsert(clientData);
      if (clientErr) {
        console.warn(`  Warning upserting client "${client.trade_name}":`, clientErr.message);
      }

      if (access?.length) {
        for (const acc of access) {
          const { error: accErr } = await supabase
            .from('client_access')
            .upsert({
              firm_id: acc.firm_id || client.firm_id,
              client_id: acc.client_id || client.id,
              user_id: acc.user_id,
              role: acc.role
            });
          if (accErr) {
            console.warn(`  Warning upserting client access for ${acc.user_id}:`, accErr.message);
          }
        }
      }
    }
  }

  // 3. Suppliers
  if (fixtures.suppliers?.length) {
    console.log(`- Upserting ${fixtures.suppliers.length} fake suppliers...`);
    for (const supplier of fixtures.suppliers) {
      const { error: supErr } = await supabase
        .from('suppliers')
        .upsert(supplier);
      if (supErr) {
        console.warn(`  Warning upserting supplier "${supplier.name}":`, supErr.message);
      }
    }
  }

  // 4. Documents
  if (fixtures.documents?.length) {
    console.log(`- Upserting ${fixtures.documents.length} fake documents...`);
    for (const doc of fixtures.documents) {
      const { error: docErr } = await supabase
        .from('documents')
        .upsert(doc);
      if (docErr) {
        console.warn(`  Warning upserting document "${doc.original_name}":`, docErr.message);
      }
    }
  }

  // 5. Invoices
  if (fixtures.invoices?.length) {
    console.log(`- Upserting ${fixtures.invoices.length} fake invoices...`);
    for (const inv of fixtures.invoices) {
      const { error: invErr } = await supabase
        .from('invoices')
        .upsert(inv);
      if (invErr) {
        console.warn(`  Warning upserting invoice "${inv.invoice_no}":`, invErr.message);
      }
    }
  }

  // 6. Sales entries
  if (fixtures.sales_entries?.length) {
    console.log(`- Upserting ${fixtures.sales_entries.length} fake sales entries...`);
    for (const sale of fixtures.sales_entries) {
      const payload = {
        ...sale,
        firm_id: sale.firm_id || clientFirmMap.get(sale.client_id)
      };
      const { error: saleErr } = await supabase
        .from('sales_entries')
        .upsert(payload);
      if (saleErr) {
        console.warn(`  Warning upserting sales entry for client ${sale.client_id}:`, saleErr.message);
      }
    }
  }

  console.log('✓ Seeding complete: Fake fixtures inserted successfully.');
}

async function main() {
  const args = process.argv.slice(2);
  const isSqlOnly = args.includes('--sql');
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
seed-fixtures.mjs - Seed fake test fixtures for local testing

Usage:
  node scripts/seed-fixtures.mjs                Insert fixtures via Supabase client
  node scripts/seed-fixtures.mjs --sql          Print SQL insert statements to stdout
  node scripts/seed-fixtures.mjs --output <file> Write SQL insert statements to file
  node scripts/seed-fixtures.mjs --help         Show this help message
`);
    return;
  }

  const fixtures = loadFixtures();

  if (isSqlOnly || outputFile) {
    const sql = generateSql(fixtures);
    if (outputFile) {
      fs.writeFileSync(path.resolve(process.cwd(), outputFile), sql, 'utf8');
      console.log(`Generated SQL written to ${outputFile}`);
    } else {
      process.stdout.write(sql);
    }
    return;
  }

  try {
    await seedViaSupabase(fixtures);
  } catch (err) {
    console.error('Error during seeding:', err.message);
    console.error('Note: If local Supabase is not running, you can generate raw SQL via:');
    console.error('  node scripts/seed-fixtures.mjs --sql');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
