#!/usr/bin/env node

/**
 * dev-invite.mjs
 * 
 * Development utility to generate client invitation links for SME shop owners.
 * Uses the Supabase service role key to bypass RLS and create invite records.
 * 
 * Usage:
 *   npm run dev:invite
 *   node scripts/dev-invite.mjs [client_id]
 *   node scripts/dev-invite.mjs --client=[client_id]
 */

import crypto from 'node:crypto';
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

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DEFAULT_SITE_URL = 'http://localhost:3000';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  DEFAULT_SERVICE_ROLE_KEY;

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  DEFAULT_SITE_URL
).replace(/\/+$/, '');

// Parse client ID from CLI arguments
function parseClientId() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--client-id=')) {
      return arg.split('=')[1].trim();
    }
    if (arg.startsWith('--client=')) {
      return arg.split('=')[1].trim();
    }
    if (!arg.startsWith('-')) {
      return arg.trim();
    }
  }
  return null;
}

// Fallback to fake tenant fixtures if db has no clients yet
function getFallbackClientId() {
  const fixturesPath = path.resolve(rootDir, 'supabase', 'fixtures', 'fake-tenants.json');
  if (fs.existsSync(fixturesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
      if (data.clients && data.clients.length > 0) {
        return {
          id: data.clients[0].id,
          name: data.clients[0].trade_name || data.clients[0].legal_name,
        };
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Shree Ganesh Stationery & Xerox [FAKE]',
  };
}

function getFirmIdForClient(clientId) {
  const fixturesPath = path.resolve(rootDir, 'supabase', 'fixtures', 'fake-tenants.json');
  if (fs.existsSync(fixturesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
      if (data.clients) {
        const found = data.clients.find((c) => c.id === clientId);
        if (found && found.firm_id) {
          return found.firm_id;
        }
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let clientId = parseClientId();
  let clientName = null;

  if (!clientId) {
    // Pick the first client from public.clients
    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, legal_name, trade_name')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!error && clients && clients.length > 0) {
        clientId = clients[0].id;
        clientName = clients[0].trade_name || clients[0].legal_name;
      }
    } catch {
      // Table query failure will fall through to fixture fallback
    }

    if (!clientId) {
      const fallback = getFallbackClientId();
      clientId = fallback.id;
      clientName = fallback.name;
    }
  } else {
    // Fetch client name for display if available
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id, legal_name, trade_name')
        .eq('id', clientId)
        .maybeSingle();

      if (client) {
        clientName = client.trade_name || client.legal_name;
      }
    } catch {
      // Ignore lookup failure
    }
  }

  // Generate 32-byte cryptographic random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let inviteToken = rawToken;
  let methodUsed = 'direct';

  // 1. Attempt RPC create_client_invite if defined
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_client_invite', {
      p_client_id: clientId,
    });

    if (!rpcError && rpcData) {
      if (typeof rpcData === 'string') {
        inviteToken = rpcData;
      } else if (rpcData.token) {
        inviteToken = rpcData.token;
      }
      methodUsed = 'rpc:create_client_invite';
    } else {
      // Also try without 'p_' prefix parameter
      const { data: rpcData2, error: rpcError2 } = await supabase.rpc('create_client_invite', {
        client_id: clientId,
      });

      if (!rpcError2 && rpcData2) {
        if (typeof rpcData2 === 'string') {
          inviteToken = rpcData2;
        } else if (rpcData2.token) {
          inviteToken = rpcData2.token;
        }
        methodUsed = 'rpc:create_client_invite';
      }
    }
  } catch {
    // RPC failed or not present, proceed to direct database insert
  }

  // 2. Fallback: If RPC was not used, insert directly using service-role client
  if (methodUsed === 'direct') {
    try {
      // Find firm_id for this client if possible
      let firmId = null;
      const { data: clientRow } = await supabase
        .from('clients')
        .select('firm_id')
        .eq('id', clientId)
        .maybeSingle();

      if (clientRow && clientRow.firm_id) {
        firmId = clientRow.firm_id;
      } else {
        firmId = getFirmIdForClient(clientId);
      }

      const inviteRecord = {
        client_id: clientId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ...(firmId ? { firm_id: firmId } : {}),
      };

      const { error: insertError } = await supabase
        .from('client_invites')
        .insert(inviteRecord);

      if (!insertError) {
        methodUsed = 'direct:client_invites';
      }
    } catch {
      // Ignore if table does not exist yet; development mock token is generated
    }
  }

  const inviteUrl = `${siteUrl}/invite/${inviteToken}`;

  console.log('\n========================================');
  console.log('  GST Saathi - Client Invite Generator');
  console.log('========================================');
  console.log(`Client ID   : ${clientId}`);
  if (clientName) {
    console.log(`Client Name : ${clientName}`);
  }
  console.log(`Mode        : ${methodUsed}`);
  console.log(`Expires     : ${expiresAt} (7 days)`);
  console.log('\nInvite Link :');
  console.log(`  ${inviteUrl}\n`);
  console.log('Share this link with the SME client owner to onboard them.');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[dev-invite] Failed to generate invite:', err);
  process.exit(1);
});
