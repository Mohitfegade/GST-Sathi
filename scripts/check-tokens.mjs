#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Hex colour regex: 3 to 8 hex digits preceded by '#' and followed by word boundary
const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;

function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkTokens() {
  const targetFiles = [];

  const componentsDir = path.join(rootDir, 'src', 'components');
  if (fs.existsSync(componentsDir)) {
    targetFiles.push(...getFilesRecursively(componentsDir));
  }

  const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
  if (fs.existsSync(pagePath)) {
    targetFiles.push(pagePath);
  }

  // Deduplicate files
  const uniqueFiles = Array.from(new Set(targetFiles));

  let totalMatchCount = 0;
  const violationsByFile = [];

  for (const filePath of uniqueFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`Error reading ${relativePath}: ${err.message}`);
      continue;
    }

    const lines = content.split(/\r?\n/);
    const fileViolations = [];

    lines.forEach((line, index) => {
      const matches = line.match(HEX_COLOR_REGEX);
      if (matches && matches.length > 0) {
        fileViolations.push({
          line: index + 1,
          matches,
          text: line.trim()
        });
        totalMatchCount += matches.length;
      }
    });

    if (fileViolations.length > 0) {
      violationsByFile.push({
        file: relativePath,
        violations: fileViolations
      });
    }
  }

  if (totalMatchCount > 0) {
    console.error(`\x1b[31m[check-tokens] FAILED: Found ${totalMatchCount} hardcoded hex colour instance(s) across ${violationsByFile.length} file(s):\x1b[0m\n`);
    for (const { file, violations } of violationsByFile) {
      console.error(`  \x1b[33m${file}\x1b[0m:`);
      for (const v of violations) {
        console.error(`    Line ${v.line}: ${v.matches.join(', ')} -> "${v.text}"`);
      }
      console.error('');
    }
    console.error('Hardcoded hex colours are prohibited. Please use design tokens or Tailwind utility classes.\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m[check-tokens] SUCCESS: No hex colour patterns found in scanned files.\x1b[0m');
    process.exit(0);
  }
}

checkTokens();
