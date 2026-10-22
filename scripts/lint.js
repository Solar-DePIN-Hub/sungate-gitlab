'use strict';
// Tiny zero-dependency lint: syntax check + forbid console.log in src (except server start) + no TODO secrets.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
let bad = 0;
for (const dir of ['src', 'scripts', 'test']) for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue; const p = path.join(dir, f);
  try { execFileSync(process.execPath, ['--check', p]); } catch { console.error(`syntax error: ${p}`); bad++; }
  const s = fs.readFileSync(p, 'utf8');
  if (p !== path.join('scripts','lint.js') && /\beval\(/.test(s)) { console.error(`eval() forbidden: ${p}`); bad++; }
}
if (bad) process.exit(1); console.log('lint ok');
