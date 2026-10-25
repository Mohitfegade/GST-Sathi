#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const domainDir = path.join(rootDir, 'src', 'lib', 'domain');

/**
 * Strips SQL comments (both block and line comments) to avoid false positives.
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

/**
 * Extracts public table names defined in a SQL migration file.
 */
function extractTablesFromSql(sql) {
  const cleanSql = stripSqlComments(sql);
  const tables = new Set();
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-zA-Z0-9_"]+)\.)?([a-zA-Z0-9_"]+)/gi;

  let match;
  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const rawSchema = match[1] ? match[1].replace(/"/g, '').toLowerCase() : 'public';
    const rawTable = match[2].replace(/"/g, '').toLowerCase();

    // Track public schema tables
    if (rawSchema === 'public') {
      tables.add(rawTable);
    }
  }

  return Array.from(tables);
}

/**
 * Recursively gets all files in a directory.
 */
function getFilesRecursively(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Generates candidate search names for a table (camelCase, PascalCase, singular, schemas, etc.)
 */
function getCandidateNames(tableName) {
  const candidates = new Set();

  // 1. Exact name
  candidates.add(tableName);

  // 2. Singularize snake_case
  let singular = tableName;
  if (tableName.endsWith('ies')) {
    singular = tableName.slice(0, -3) + 'y';
  } else if (tableName.endsWith('ses') || tableName.endsWith('xes') || tableName.endsWith('shes') || tableName.endsWith('ches')) {
    singular = tableName.slice(0, -2);
  } else if (tableName.endsWith('s') && !tableName.endsWith('ss')) {
    singular = tableName.slice(0, -1);
  }
  candidates.add(singular);

  const parts = tableName.split('_');
  const singularParts = singular.split('_');

  const toCamel = (arr) =>
    arr.map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join('');
  const toPascal = (arr) =>
    arr.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');

  candidates.add(toCamel(parts));
  candidates.add(toCamel(singularParts));
  candidates.add(toPascal(parts));
  candidates.add(toPascal(singularParts));

  // 3. Zod schema names (e.g. invoiceSchema, invoiceLineSchema, firmSchema)
  candidates.add(`${toCamel(parts)}Schema`);
  candidates.add(`${toCamel(singularParts)}Schema`);

  return Array.from(candidates);
}

function checkSchemaSync() {
  console.log('\x1b[36m[check-schema-sync] Verifying Supabase migrations <-> domain models...\x1b[0m\n');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`\x1b[31m[check-schema-sync] Error: Migrations directory not found at ${migrationsDir}\x1b[0m`);
    process.exit(1);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const allTables = new Map(); // table_name -> source migration file

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const tables = extractTablesFromSql(content);
    for (const table of tables) {
      if (!allTables.has(table)) {
        allTables.set(table, file);
      }
    }
  }

  const tableList = Array.from(allTables.keys()).sort();
  console.log(`Found ${tableList.length} table(s) defined across ${migrationFiles.length} migration file(s).`);

  if (!fs.existsSync(domainDir)) {
    console.error(`\x1b[31m[check-schema-sync] FAILED: Domain directory not found at ${domainDir}\x1b[0m\n`);
    for (const table of tableList) {
      console.error(`  ✗ Missing model for table: ${table} (from ${allTables.get(table)})`);
    }
    process.exit(1);
  }

  const domainFiles = getFilesRecursively(domainDir).filter(
    (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')
  );

  const domainFileContents = new Map();
  for (const file of domainFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    domainFileContents.set(file, content);
  }

  const missing = [];
  const matched = [];

  for (const table of tableList) {
    const candidates = getCandidateNames(table);
    let foundMatch = null;

    for (const [filePath, content] of domainFileContents.entries()) {
      const fileName = path.basename(filePath, path.extname(filePath));
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

      // Check if file name matches any candidate
      if (candidates.some((c) => c.toLowerCase() === fileName.toLowerCase())) {
        foundMatch = { file: relPath, pattern: `file:${fileName}` };
        break;
      }

      // Check if file content exports or defines model / schema / type
      for (const candidate of candidates) {
        const defPattern = new RegExp(`\\b(export\\s+(?:type|interface|const|class)\\s+${candidate}\\b)`, 'i');
        const schemaPattern = new RegExp(`\\b${candidate}\\b`);
        const tableLiteralPattern = new RegExp(`['"\`]${table}['"\`]`);

        if (defPattern.test(content)) {
          foundMatch = { file: relPath, pattern: candidate };
          break;
        } else if (schemaPattern.test(content) && content.includes('z.object')) {
          foundMatch = { file: relPath, pattern: `${candidate} (zod)` };
          break;
        } else if (tableLiteralPattern.test(content)) {
          foundMatch = { file: relPath, pattern: `table_name:${table}` };
          break;
        }
      }

      if (foundMatch) break;
    }

    if (foundMatch) {
      matched.push({ table, source: allTables.get(table), match: foundMatch });
    } else {
      missing.push({ table, source: allTables.get(table) });
    }
  }

  // Print matched results
  console.log(`\n\x1b[32mMatched models (${matched.length}/${tableList.length}):\x1b[0m`);
  for (const m of matched) {
    console.log(`  ✓ ${m.table.padEnd(25)} -> ${m.match.file} (${m.match.pattern})`);
  }

  if (missing.length > 0) {
    console.error(
      `\n\x1b[31m[check-schema-sync] FAILED: ${missing.length} table(s) missing corresponding domain models in src/lib/domain/:\x1b[0m\n`
    );
    for (const m of missing) {
      console.error(`  ✗ ${m.table} (defined in supabase/migrations/${m.source})`);
    }
    console.error('\nPlease define domain models (Zod schema and TypeScript type) for each missing table.');
    process.exit(1);
  }

  console.log(
    `\n\x1b[32m[check-schema-sync] SUCCESS: All ${tableList.length} migration table(s) have corresponding domain models in src/lib/domain/.\x1b[0m\n`
  );
  process.exit(0);
}

checkSchemaSync();
