#!/usr/bin/env node
/**
 * Scans source files for common mojibake (garbled UTF-8) sequences.
 * All mojibake patterns are defined via Unicode escapes to keep this
 * script's source file free of non-ASCII bytes (avoids self-matching).
 *
 * Exit code 1 if any are found; 0 otherwise.
 */

const fs = require('fs');
const path = require('path');

// --- Mojibake patterns (label, RegExp source) ---
// Each entry: [label, regexp-source-as-string]
// The regexp source is a Unicode-escaped string so this file stays pure ASCII.
const MOJIBAKE_PATTERNS = [
  ['\\u9225', '\\u9225'],   // GBK misread of right single quote
  ['\\u922B', '\\u922B'],   // GBK misread of arrow
  ['\\u7487', '\\u7487'],   // GBK misread
  ['\\u9427', '\\u9427'],   // GBK misread
  ['\\u9357', '\\u9357'],   // GBK misread
  ['\\u6D93', '\\u6D93'],   // GBK misread
  ['\\u93C6', '\\u93C6'],   // GBK misread
  ['\\u95AD', '\\u95AD'],   // GBK misread
  ['\\u7035', '\\u7035'],   // GBK misread
  ['\\u59D2', '\\u59D2'],   // GBK misread
  ['\\u68F0', '\\u68F0'],   // GBK misread
  ['\\u9286', '\\u9286'],   // GBK misread
  ['\\u4E12PAY', '\\u4E12PAY'], // GBK misread of em-dash + PAY
];

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.umi', '.next', 'coverage',
]);

const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml',
  '.sh', '.ps1', '.env', '.env.example', '.env.production.example',
  '.html', '.css', '.scss', '.prisma', '.sql',
]);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.has(ext) || entry.name === 'Dockerfile' || entry.name === 'Makefile') {
        files.push(full);
      }
    }
  }
}

const SELF_PATH = path.resolve(__filename);
const root = process.argv[2] || process.cwd();
const files = [];
walk(root, files);

let found = 0;

for (const file of files) {
  // Skip this script itself to avoid self-matching
  if (path.resolve(file) === SELF_PATH) continue;

  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const [label, patternSrc] of MOJIBAKE_PATTERNS) {
    const re = new RegExp(patternSrc, 'g');
    let match;
    while ((match = re.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      const relPath = path.relative(root, file);
      console.error('MOJIBAKE: ' + relPath + ':' + line + ' contains <' + label + '>');
      found++;
    }
  }
}

if (found > 0) {
  console.error('\nFound ' + found + ' mojibake occurrence(s). Fix the garbled text above.');
  process.exit(1);
} else {
  console.log('No mojibake detected.');
  process.exit(0);
}
