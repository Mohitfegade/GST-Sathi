#!/usr/bin/env node

/**
 * scripts/cleanup-uploads.mjs
 *
 * Standalone CLI executable script to trigger cleanup of stale, unconfirmed document uploads.
 * Finds unconfirmed documents in public.documents where status = 'uploaded' and created_at < cutoff,
 * deletes the corresponding storage objects in bucket 'documents', and marks the document rows as deleted.
 *
 * Usage:
 *   node scripts/cleanup-uploads.mjs
 *   node scripts/cleanup-uploads.mjs --client=<client_id>
 *   node scripts/cleanup-uploads.mjs --maxAgeHours=2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupStaleUploads } from '../src/lib/uploads/cleanup.ts';

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

async function main() {
  const args = process.argv.slice(2);
  let clientId = undefined;
  let maxAgeHours = undefined;

  for (const arg of args) {
    if (arg.startsWith('--client=')) {
      clientId = arg.slice('--client='.length).trim();
    } else if (arg.startsWith('--clientId=')) {
      clientId = arg.slice('--clientId='.length).trim();
    } else if (arg.startsWith('--maxAgeHours=')) {
      const parsed = parseFloat(arg.slice('--maxAgeHours='.length));
      if (!Number.isNaN(parsed)) maxAgeHours = parsed;
    } else if (arg.startsWith('--age=')) {
      const parsed = parseFloat(arg.slice('--age='.length));
      if (!Number.isNaN(parsed)) maxAgeHours = parsed;
    }
  }

  try {
    const result = await cleanupStaleUploads({ clientId, maxAgeHours });

    console.log(`Checked stale uploads: ${result.totalCleaned} cleaned up.`);
    if (result.storageObjectsRemoved > 0) {
      console.log(`Storage objects removed: ${result.storageObjectsRemoved}`);
    }
    if (result.errors && result.errors.length > 0) {
      console.warn(`Errors encountered during cleanup (${result.errors.length}):`);
      for (const err of result.errors) {
        console.warn(`  - ${err}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to run stale uploads cleanup: ${message}`);
  }

  process.exitCode = 0;
}

main();
