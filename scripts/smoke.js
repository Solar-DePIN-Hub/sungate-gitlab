'use strict';
// Post-deploy smoke + monitor probe. Exits non-zero so the incident flow can trigger.
const base = process.env.APP_URL || 'http://127.0.0.1:8080';
(async () => {
  const t = Date.now();
  const h = await fetch(`${base}/healthz`); const f = await fetch(`${base}/api/forecast?lat=50.45&lon=30.52&hours=2`);
  const ms = Date.now() - t; const ok = h.ok && f.ok && (await f.json()).hourly.length === 2;
  const r = { base, ok, latencyMs: ms, at: new Date().toISOString() };
  require('node:fs').writeFileSync('smoke-report.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r));
  if (!ok || ms > 3000) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
