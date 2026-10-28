#!/usr/bin/env node

/**
 * seed-clients.mjs
 *
 * Standalone Node.js script to seed 12 realistic but strictly FAKE SME retail
 * and wholesale clients into the local Supabase database for development.
 *
 * Usage:
 *   npm run db:seed:clients
 *   node scripts/seed-clients.mjs
 *   node scripts/seed-clients.mjs --firm=<firm_uuid>
 *   node scripts/seed-clients.mjs --clean
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

// Local Supabase defaults
const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SERVICE_ROLE_KEY;

// Checksum verification helpers for safety check
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function calculateGstinChecksum(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = first14[i];
    const val = GSTIN_CHARS.indexOf(char);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = val * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }
  const checkDigit = (36 - (sum % 36)) % 36;
  return GSTIN_CHARS[checkDigit];
}

function verifyFixtureGstin(gstin) {
  if (!gstin || typeof gstin !== 'string' || gstin.length !== 15) return false;
  const upper = gstin.trim().toUpperCase();
  const first14 = upper.slice(0, 14);
  const expectedCheck = calculateGstinChecksum(first14);
  return upper[14] === expectedCheck;
}

// Parse CLI options
function parseArgs() {
  const args = process.argv.slice(2);
  let firmId = null;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
seed-clients.mjs - Seed 12 fake SME clients for local development

Usage:
  npm run db:seed:clients                   Seed clients under first active firm
  node scripts/seed-clients.mjs [options]

Options:
  --firm=<uuid>, --firm-id=<uuid>          Target specific firm UUID
  --help, -h                               Show this help message
`);
      process.exit(0);
    }
    if (arg.startsWith('--firm=')) {
      firmId = arg.split('=')[1].trim();
    } else if (arg.startsWith('--firm-id=')) {
      firmId = arg.split('=')[1].trim();
    } else if (!arg.startsWith('-') && /^[0-9a-f-]{36}$/i.test(arg.trim())) {
      firmId = arg.trim();
    }
  }

  return { firmId };
}

// Read and validate fake clients JSON fixture
function loadClientsFixture() {
  const fixturePath = path.resolve(rootDir, 'supabase', 'fixtures', 'clients.fake.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Clients fixture file not found at ${fixturePath}`);
  }

  const raw = fs.readFileSync(fixturePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse clients.fake.json: ${err.message}`);
  }

  const clients = Array.isArray(data) ? data : data.clients;
  if (!Array.isArray(clients) || clients.length === 0) {
    throw new Error('No client records found in supabase/fixtures/clients.fake.json');
  }

  return clients;
}

// Resolve or auto-provision target firm
async function resolveFirm(supabase, explicitFirmId) {
  if (explicitFirmId) {
    const { data: firm, error } = await supabase
      .from('firms')
      .select('id, name')
      .eq('id', explicitFirmId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error looking up firm ${explicitFirmId}: ${error.message}`);
    }
    if (!firm) {
      throw new Error(`Firm with ID ${explicitFirmId} was not found in the database.`);
    }
    return firm;
  }

  // Check DEV_FIRM_ID or FIRM_ID from environment
  const envFirmId = process.env.DEV_FIRM_ID || process.env.FIRM_ID;
  if (envFirmId) {
    const { data: firm } = await supabase
      .from('firms')
      .select('id, name')
      .eq('id', envFirmId)
      .maybeSingle();
    if (firm) return firm;
  }

  // Look up first active firm in database
  const { data: firms, error: fetchErr } = await supabase
    .from('firms')
    .select('id, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchErr) {
    throw new Error(`Failed to query firms: ${fetchErr.message}`);
  }

  if (firms && firms.length > 0) {
    return firms[0];
  }

  // If no firm exists, check if fake-tenants.json has a dev firm definition
  console.log('No existing firm found in database. Initializing default dev firm...');
  const fakeTenantsPath = path.resolve(rootDir, 'supabase', 'fixtures', 'fake-tenants.json');
  let fallbackId = '11111111-1111-4111-8111-111111111111';
  let fallbackName = 'Acme Tax Consultants [FAKE]';

  if (fs.existsSync(fakeTenantsPath)) {
    try {
      const tenantsData = JSON.parse(fs.readFileSync(fakeTenantsPath, 'utf8'));
      if (tenantsData.firms && tenantsData.firms.length > 0) {
        fallbackId = tenantsData.firms[0].id || fallbackId;
        fallbackName = tenantsData.firms[0].name || fallbackName;
      }
    } catch {
      // Ignore parse errors and use hardcoded dev firm fallback
    }
  }

  const { data: newFirm, error: createErr } = await supabase
    .from('firms')
    .upsert({
      id: fallbackId,
      name: fallbackName,
    })
    .select('id, name')
    .single();

  if (createErr) {
    throw new Error(`Failed to create default dev firm: ${createErr.message}`);
  }

  return newFirm;
}

async function main() {
  const { firmId: requestedFirmId } = parseArgs();

  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify connection by resolving firm
  let firm;
  try {
    firm = await resolveFirm(supabase, requestedFirmId);
  } catch (err) {
    console.error(`\nConnection Error: ${err.message}`);
    console.error('\nEnsure local Supabase is running with:');
    console.error('  npm run db:start');
    process.exit(1);
  }

  console.log(`Target Accounting Firm: "${firm.name}" (${firm.id})`);

  const rawClients = loadClientsFixture();
  console.log(`Loaded ${rawClients.length} fake client fixture records from supabase/fixtures/clients.fake.json`);

  console.log(`\nSeeding ${rawClients.length} fake SME clients...`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < rawClients.length; i++) {
    const raw = rawClients[i];
    const indexStr = `[${String(i + 1).padStart(2, ' ')}/${rawClients.length}]`;

    // Strict validation
    if (!verifyFixtureGstin(raw.gstin)) {
      console.error(`  ✗ ${indexStr} Invalid GSTIN checksum for "${raw.trade_name}": ${raw.gstin}`);
      continue;
    }

    if (!raw.legal_name.includes('FAKE') || (raw.trade_name && !raw.trade_name.includes('FAKE'))) {
      console.warn(`  ! ${indexStr} Warning: Client name should clearly include "FAKE": ${raw.trade_name}`);
    }

    // Check if client with this GSTIN already exists for this firm
    const { data: existingClient, error: findErr } = await supabase
      .from('clients')
      .select('id')
      .eq('firm_id', firm.id)
      .eq('gstin', raw.gstin)
      .maybeSingle();

    if (findErr) {
      console.warn(`  Warning checking existing client ${raw.gstin}: ${findErr.message}`);
    }

    const clientId = existingClient?.id || raw.id;

    // Database payload conforming strictly to public.clients schema
    const payload = {
      id: clientId,
      firm_id: firm.id,
      legal_name: raw.legal_name,
      trade_name: raw.trade_name || null,
      gstin: raw.gstin,
      state_code: raw.state_code,
      scheme: raw.scheme || 'regular',
      aato_band: raw.aato_band || 'below_40l',
      fy_start_month: raw.fy_start_month ?? 4,
      language: raw.language || 'en',
      sells_exempt: raw.sells_exempt ?? false,
      sells_taxable: raw.sells_taxable ?? true,
    };

    const { error: upsertErr } = await supabase
      .from('clients')
      .upsert(payload, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`  ✗ ${indexStr} Failed to seed "${raw.trade_name}": ${upsertErr.message}`);
    } else {
      if (existingClient) {
        updatedCount++;
        console.log(`  ✓ ${indexStr} Updated:  ${raw.trade_name} (${raw.gstin}) [${raw.scheme}, ${raw.aato_band}]`);
      } else {
        insertedCount++;
        console.log(`  ✓ ${indexStr} Inserted: ${raw.trade_name} (${raw.gstin}) [${raw.scheme}, ${raw.aato_band}]`);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`✓ Seeding finished!`);
  console.log(`  Target Firm : "${firm.name}" (${firm.id})`);
  console.log(`  Total seeded: ${insertedCount + updatedCount} of ${rawClients.length} clients (${insertedCount} new, ${updatedCount} updated)`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in seed-clients:', err);
  process.exit(1);
});
