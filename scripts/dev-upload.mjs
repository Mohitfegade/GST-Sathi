#!/usr/bin/env node

/**
 * dev-upload.mjs
 *
 * Standalone development script to upload synthetic sample purchase bills
 * from `supabase/fixtures/bills/` for a given client ID using the local
 * Supabase instance.
 *
 * Usage:
 *   npm run dev:upload
 *   npm run dev:upload -- [options]
 *   node scripts/dev-upload.mjs [client_id]
 *   node scripts/dev-upload.mjs --client=<client_id> [options]
 *
 * Options:
 *   --client, -c <uuid>   Target client ID (defaults to first client in local database)
 *   --file, -f <name>     Upload a specific bill (e.g. fake_invoice_1.png)
 *   --all                 Upload all fixture bills (default behavior)
 *   --period <MMYYYY>     GST Return Filing Period (default: "102026")
 *   --queue               Set status to 'queued' immediately (default: true)
 *   --clean               Clean up previous fixture uploads for this client first
 *   --help, -h            Show help and usage examples
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { generateFakeBills } from './generate-fake-bills.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const billsDir = path.join(rootDir, 'supabase', 'fixtures', 'bills');

// Maximum file size in bytes: 10 MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_STORAGE_BUCKET = 'documents';
const DEFAULT_PERIOD_FP = '102026';

// Load environment variables from .env.local or .env
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

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  DEFAULT_SERVICE_ROLE_KEY;

// Minimal MIME sniffer using file magic numbers
function sniffBufferMime(buffer) {
  if (!buffer || buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

// Fallback MIME deduction from extension
function getMimeByExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.pdf':
      return 'application/pdf';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    clientId: null,
    fileName: null,
    period: DEFAULT_PERIOD_FP,
    queue: true,
    clean: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--client=')) {
      options.clientId = arg.split('=')[1].trim();
    } else if (arg.startsWith('--client-id=')) {
      options.clientId = arg.split('=')[1].trim();
    } else if (arg === '--client' || arg === '-c') {
      options.clientId = args[++i]?.trim();
    } else if (arg.startsWith('--file=')) {
      options.fileName = arg.split('=')[1].trim();
    } else if (arg === '--file' || arg === '-f') {
      options.fileName = args[++i]?.trim();
    } else if (arg.startsWith('--period=')) {
      options.period = arg.split('=')[1].trim();
    } else if (arg === '--period') {
      options.period = args[++i]?.trim();
    } else if (arg === '--clean') {
      options.clean = true;
    } else if (arg === '--no-queue') {
      options.queue = false;
    } else if (arg === '--queue') {
      options.queue = true;
    } else if (!arg.startsWith('-') && !options.clientId) {
      options.clientId = arg.trim();
    }
  }

  return options;
}

function printHelp() {
  console.log(`
GST Saathi - Dev Purchase Bill Uploader
=======================================
Uploads synthetic sample purchase bills from supabase/fixtures/bills/
to the local Supabase storage bucket and registers them in public.documents.

Usage:
  npm run dev:upload
  npm run dev:upload -- [options]
  node scripts/dev-upload.mjs [client_id]
  node scripts/dev-upload.mjs --client=<client_id> [options]

Options:
  --client, -c <uuid>   Client UUID to upload bills for (defaults to first client in DB)
  --file, -f <name>     Upload a specific bill (e.g. fake_invoice_1.png)
  --period <MMYYYY>     GST Return Filing Period (default: "102026")
  --clean               Clean up previous active fixture uploads for this client before uploading
  --no-queue            Leave uploaded documents in 'uploaded' status instead of advancing to 'queued'
  --help, -h            Show this help message

Sample Fixtures Available:
  - fake_invoice_1.png  (PNG with visual FAKE watermark, 640x480)
  - fake_invoice_2.jpg  (JPEG with JFIF & COM watermark, 640x480)
  - fake_invoice_3.pdf  (PDF-1.4 with text "SAMPLE FAKE BILL FOR TESTING ONLY")
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  console.log(`Connecting to local Supabase at ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify Supabase connection
  try {
    const { error: pingErr } = await supabase.from('firms').select('id').limit(1);
    if (pingErr) {
      console.error(`\n✖ Could not query database: ${pingErr.message}`);
      console.error('Make sure local Supabase is running with: npm run db:start');
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n✖ Connection failure to ${supabaseUrl}: ${err.message}`);
    console.error('Make sure local Supabase is running with: npm run db:start');
    process.exit(1);
  }

  // Ensure documents bucket exists in storage
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasDocBucket = buckets && buckets.some((b) => b.id === DEFAULT_STORAGE_BUCKET);
  if (!hasDocBucket) {
    console.log(`Storage bucket '${DEFAULT_STORAGE_BUCKET}' not found, creating it...`);
    const { error: createBucketErr } = await supabase.storage.createBucket(DEFAULT_STORAGE_BUCKET, {
      public: false,
    });
    if (createBucketErr && !createBucketErr.message.includes('already exists')) {
      console.warn(`Warning creating storage bucket: ${createBucketErr.message}`);
    }
  }

  // Resolve client ID
  let client = null;

  if (options.clientId) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, firm_id, trade_name, legal_name, gstin')
      .eq('id', options.clientId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      console.error(`\n✖ Client ID '${options.clientId}' was not found in the database.`);
      console.error('Run "npm run db:seed:clients" to seed test SME clients, or omit the client argument to use the first active client.');
      process.exit(1);
    }
    client = data;
  } else {
    // Pick the first client in the database
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, firm_id, trade_name, legal_name, gstin')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !clients || clients.length === 0) {
      console.error('\n✖ No clients found in database.');
      console.error('Please seed test clients first by running:');
      console.error('  npm run db:seed:clients\n');
      process.exit(1);
    }
    client = clients[0];
  }

  const clientDisplayName = client.trade_name || client.legal_name || 'Client';
  console.log(`\nTarget Client : "${clientDisplayName}"`);
  console.log(`  Client ID   : ${client.id}`);
  console.log(`  Firm ID     : ${client.firm_id}`);
  console.log(`  GSTIN       : ${client.gstin || 'Unregistered'}`);
  console.log(`  Period      : ${options.period}`);

  // Ensure fake bill fixtures exist
  if (!fs.existsSync(billsDir)) {
    console.log('\nGenerating sample fake bills in supabase/fixtures/bills/...');
    await generateFakeBills();
  } else {
    const existingBills = fs.readdirSync(billsDir).filter((f) => !f.startsWith('.'));
    if (existingBills.length < 3) {
      console.log('\nRegenerating missing fake bills in supabase/fixtures/bills/...');
      await generateFakeBills({ force: true });
    }
  }

  // Determine which files to upload
  let targetFileNames = [];
  if (options.fileName) {
    const specifiedPath = path.join(billsDir, options.fileName);
    if (!fs.existsSync(specifiedPath)) {
      console.error(`\n✖ Fixture file not found: ${options.fileName}`);
      console.error(`Available files in ${billsDir}:`);
      for (const f of fs.readdirSync(billsDir)) {
        console.error(`  - ${f}`);
      }
      process.exit(1);
    }
    targetFileNames = [options.fileName];
  } else {
    targetFileNames = fs
      .readdirSync(billsDir)
      .filter((f) => !f.startsWith('.') && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.pdf') || f.endsWith('.webp')));
  }

  if (targetFileNames.length === 0) {
    console.error('\n✖ No fixture bill files found to upload.');
    process.exit(1);
  }

  // Handle --clean option
  if (options.clean) {
    console.log('\n[--clean] Removing previous test document uploads for this client...');
    const { data: previousDocs } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('client_id', client.id)
      .eq('kind', 'purchase_bill')
      .is('deleted_at', null);

    if (previousDocs && previousDocs.length > 0) {
      for (const prev of previousDocs) {
        await supabase.storage.from(DEFAULT_STORAGE_BUCKET).remove([prev.storage_path]);
      }
      await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('client_id', client.id)
        .eq('kind', 'purchase_bill')
        .is('deleted_at', null);
      console.log(`  ✓ Cleaned up ${previousDocs.length} prior document(s).`);
    } else {
      console.log('  No prior documents found for this client.');
    }
  }

  console.log(`\nUploading ${targetFileNames.length} file(s) from supabase/fixtures/bills/...\n`);

  const results = [];

  for (const fileName of targetFileNames) {
    const filePath = path.join(billsDir, fileName);
    const fileBuffer = fs.readFileSync(filePath);

    // Validate size limit
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      console.warn(`  ✖ Skipping ${fileName}: Exceeds 10 MB limit (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      results.push({ name: fileName, status: 'rejected', reason: 'exceeds_max_size' });
      continue;
    }

    // Sniff MIME type
    const mimeType = sniffBufferMime(fileBuffer) || getMimeByExtension(fileName);

    // Compute SHA-256 hash
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex').toLowerCase();

    // Check for duplicate active document for this client
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, storage_path, status, original_name')
      .eq('client_id', client.id)
      .eq('sha256', sha256)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingDoc) {
      console.log(`  ℹ Duplicate skipped: ${fileName}`);
      console.log(`    Existing Doc ID : ${existingDoc.id}`);
      console.log(`    Status          : ${existingDoc.status}`);
      console.log(`    SHA-256         : ${sha256}`);
      results.push({
        name: fileName,
        status: 'duplicate',
        documentId: existingDoc.id,
        storagePath: existingDoc.storage_path,
        sha256,
      });
      continue;
    }

    // Prepare direct upload
    const documentId = crypto.randomUUID();
    const storagePath = `${client.firm_id}/${client.id}/${documentId}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      console.error(`  ✖ Storage upload failed for ${fileName}: ${uploadErr.message}`);
      results.push({ name: fileName, status: 'error', reason: uploadErr.message });
      continue;
    }

    // Insert record in public.documents
    const targetStatus = options.queue ? 'queued' : 'uploaded';
    const { data: docRecord, error: insertErr } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        firm_id: client.firm_id,
        client_id: client.id,
        kind: 'purchase_bill',
        storage_path: storagePath,
        original_name: fileName,
        mime_type: mimeType,
        size_bytes: fileBuffer.length,
        sha256: sha256,
        status: targetStatus,
        period_fp: options.period,
      })
      .select('id, original_name, status, storage_path, created_at')
      .single();

    if (insertErr) {
      console.error(`  ✖ Database insert failed for ${fileName}: ${insertErr.message}`);
      // Clean up uploaded storage object on DB failure
      await supabase.storage.from(DEFAULT_STORAGE_BUCKET).remove([storagePath]);
      results.push({ name: fileName, status: 'error', reason: insertErr.message });
      continue;
    }

    console.log(`  ✓ Uploaded: ${fileName}`);
    console.log(`    Document ID  : ${docRecord.id}`);
    console.log(`    Storage Path : ${docRecord.storage_path}`);
    console.log(`    MIME Type    : ${mimeType}`);
    console.log(`    Size         : ${fileBuffer.length} bytes`);
    console.log(`    SHA-256      : ${sha256}`);
    console.log(`    Status       : ${docRecord.status}`);
    console.log('');

    results.push({
      name: fileName,
      status: docRecord.status,
      documentId: docRecord.id,
      storagePath: docRecord.storage_path,
      mimeType,
      sizeBytes: fileBuffer.length,
      sha256,
    });
  }

  // Summary
  console.log('================================================================');
  console.log('Upload Summary:');
  const uploadedCount = results.filter((r) => r.status === 'uploaded' || r.status === 'queued').length;
  const duplicateCount = results.filter((r) => r.status === 'duplicate').length;
  const errorCount = results.filter((r) => r.status === 'error' || r.status === 'rejected').length;

  console.log(`  Successful uploads : ${uploadedCount}`);
  console.log(`  Duplicates skipped : ${duplicateCount}`);
  console.log(`  Failures / Errors  : ${errorCount}`);
  console.log('================================================================\n');

  if (uploadedCount > 0) {
    console.log('To view uploaded documents in the database:');
    console.log(`  select id, kind, original_name, status, period_fp from documents where client_id = '${client.id}';\n`);
  }
}

main().catch((err) => {
  console.error('\nFatal error running dev-upload:', err);
  process.exit(1);
});
