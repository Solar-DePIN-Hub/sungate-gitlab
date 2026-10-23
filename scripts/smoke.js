'use strict';
// Post-deploy smoke test and production monitor probe.
// Exit 1 on failure so the pipeline fails and the Pipeline Doctor flow opens an incident.
const fs = require('node:fs');
const base = (process.env.APP_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const mode = process.env.SMOKE_MODE || 'api'; // api = container/Cloud Run, static = GitLab Pages
const maxMs = Number(process.env.SMOKE_MAX_MS || 3000);

async function check(name, url, test) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await r.text();
    const ok = r.ok && test(body);
    return { name, url, status: r.status, ok, ms: Date.now() - t };
  } catch (e) { return { name, url, ok: false, error: e.message, ms: Date.now() - t }; }
}

(async () => {
  const checks = [await check('home', `${base}/`, b => b.includes('SunGate'))];
  if (mode === 'api') {
    checks.push(await check('healthz', `${base}/healthz`, b => JSON.parse(b).ok === true));
    checks.push(await check('forecast', `${base}/api/forecast?lat=50.45&lon=30.52&hours=2`, b => JSON.parse(b).hourly.length === 2));
    checks.push(await check('bad-input-rejected', `${base}/api/forecast?lat=999&lon=0`, () => true).then(c => ({ ...c, ok: c.status === 400 })));
  } else {
    checks.push(await check('solar.js', `${base}/solar.js`, b => b.includes('forecast')));
    checks.push(await check('carbon.js', `${base}/carbon.js`, b => b.includes('greenWindow')));
  }
  const latencyMs = Math.max(...checks.map(c => c.ms));
  const ok = checks.every(c => c.ok) && latencyMs <= maxMs;
  const report = { base, mode, ok, latencyMs, maxMs, at: new Date().toISOString(), commit: process.env.CI_COMMIT_SHORT_SHA || 'local', checks };
  fs.writeFileSync('smoke-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exit(1);
})();
