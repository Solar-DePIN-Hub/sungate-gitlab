'use strict';
// Regression test for the GitLab Pages build: the page loads solar.js and carbon.js as classic
// <script> tags that share one global scope. A duplicate top-level `const` broke the page in production
// ("Identifier 'api' has already been declared" → "SunGateCarbon is not defined").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('solar.js and carbon.js load together as browser scripts and expose both globals', () => {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, AbortController, Date, Math });
  ctx.globalThis = ctx;
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  assert.deepEqual(order, ['solar.js', 'carbon.js']);
  for (const f of order) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
  }
  assert.equal(typeof ctx.SunGateSolar.forecast, 'function');
  assert.equal(typeof ctx.SunGateCarbon.greenWindow, 'function');
  const f = ctx.SunGateSolar.forecast({ lat: 50.45, lon: 30.52, areaM2: 1.6, hours: 24, tilt: 35, start: new Date('2026-06-21T00:00:00Z') });
  assert.ok(f.energyWh > 0);
});

test('the inline page script only uses globals the two files define', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const inline = html.split('<script>')[1].split('</script>')[0];
  for (const g of inline.match(/SunGate[A-Za-z]+/g)) assert.ok(['SunGateSolar', 'SunGateCarbon'].includes(g), g);
});
