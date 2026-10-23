'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createHandler, _resetCache } = require('../src/server');
const fixture = require('./fixtures/uk-fw24h.json');

const clock = () => new Date('2026-10-23T08:15:00Z'); // when the fixture was captured
async function withServer(fetchImpl, fn) {
  _resetCache();
  const srv = http.createServer(createHandler({ fetchImpl, clock })).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  try { await fn(base); } finally { srv.close(); }
}
const okFetch = async () => ({ ok: true, status: 200, json: async () => fixture });

test('healthz', () => withServer(okFetch, async (b) => {
  const r = await fetch(`${b}/healthz`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await r.json()).ok, true);
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
}));

test('forecast happy path and validation', () => withServer(okFetch, async (b) => {
  const ok = await fetch(`${b}/api/forecast?lat=50&lon=30&hours=3`);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await ok.json()).hourly.length, 3);
  for (const q of ['lat=999&lon=0', 'lon=0', 'lat=1&lon=1&hours=0', 'lat=1&lon=1&hours=2.5', 'lat=1&lon=1&area=-3', 'lat=abc&lon=1']) {
    assert.strictEqual((await fetch(`${b}/api/forecast?${q}`)).status, 400, q);
  }
}));

test('green-window uses the carbon forecast', () => withServer(okFetch, async (b) => {
  const r = await fetch(`${b}/api/green-window?duration=60&horizon=24`);
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.region, 'GB');
  assert.strictEqual(j.now.avgGPerKWh, 95.5);
  assert.strictEqual(j.best.avgGPerKWh, 43);
  assert.strictEqual(j.best.start, '2026-10-23T22:30:00.000Z');
}));

test('green-window validates input', () => withServer(okFetch, async (b) => {
  for (const q of ['duration=5', 'duration=1000', 'horizon=0', 'horizon=48', 'duration=abc']) {
    assert.strictEqual((await fetch(`${b}/api/green-window?${q}`)).status, 400, q);
  }
}));

test('green-window returns 503 when upstream is down', () => withServer(async () => { throw new Error('down'); }, async (b) => {
  const r = await fetch(`${b}/api/green-window`);
  assert.strictEqual(r.status, 503);
}));

test('static page and shared browser modules', () => withServer(okFetch, async (b) => {
  const page = await fetch(`${b}/`);
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /SunGate/);
  assert.match(await (await fetch(`${b}/carbon.js`)).text(), /greenWindow/);
  assert.match(await (await fetch(`${b}/solar.js`)).text(), /forecast/);
}));

test('unknown path 404 and non-GET 405', () => withServer(okFetch, async (b) => {
  assert.strictEqual((await fetch(`${b}/nope`)).status, 404);
  assert.strictEqual((await fetch(`${b}/healthz`, { method: 'POST' })).status, 405);
}));

test('forecast tilt parameter', () => withServer(okFetch, async (b) => {
  const get = async (q) => fetch(`${b}/api/forecast?lat=50&lon=30&hours=24${q}`);
  for (const t of [0, 30, 90]) {
    const r = await get(`&tilt=${t}`);
    assert.strictEqual(r.status, 200, `tilt=${t}`);
    assert.strictEqual((await r.json()).tilt, t);
  }
  for (const t of ['-1', '91', 'abc']) {
    const r = await get(`&tilt=${t}`);
    assert.strictEqual(r.status, 400, `tilt=${t}`);
    assert.match((await r.json()).error, /tilt/);
  }
  const def = await (await get('')).json();
  const zero = await (await get('&tilt=0')).json();
  assert.deepStrictEqual(def.hourly, zero.hourly);
  assert.strictEqual(def.energyWh, zero.energyWh);
}));
