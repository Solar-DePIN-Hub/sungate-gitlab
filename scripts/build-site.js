'use strict';
// Build the static production site for GitLab Pages into ./site (the app's UI + shared model code).
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, '..', 'site');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const [src, dst] of [['public/index.html', 'index.html'], ['src/solar.js', 'solar.js'], ['src/carbon.js', 'carbon.js']]) {
  fs.copyFileSync(path.join(__dirname, '..', src), path.join(out, dst));
}
if (fs.existsSync('sci-report.json')) fs.copyFileSync('sci-report.json', path.join(out, 'sci-report.json'));
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ commit: process.env.CI_COMMIT_SHORT_SHA || 'local', builtAt: new Date().toISOString() }));
console.log('site built:', fs.readdirSync(out).join(', '));
