'use strict';
const test = require('node:test');
const assert = require('node:assert');
const carbon = require('../src/carbon');
const fixture = require('./fixtures/uk-fw24h.json');

const NOW = new Date('2026-10-23T08:15:00Z'); // fixture was captured at this time (real GB grid data)
const slots = carbon.parseSlots(fixture);

test('parseSlots normalises the real GB payload', () => {
  assert.strictEqual(slots.length, 49);
  assert.strictEqual(slots[0].from, '2026-10-23T07:30:00.000Z');
  assert.strictEqual(slots[0].gPerKWh, 98, 'uses actual when present');
  assert.strictEqual(slots[48].gPerKWh, 66, 'falls back to forecast');
});

test('parseSlots ignores junk rows and bad payloads', () => {
  assert.deepStrictEqual(carbon.parseSlots(null), []);
  assert.deepStrictEqual(carbon.parseSlots({ data: [{ from: 'x', intensity: { forecast: 1 } }, { from: '2026-01-01T00:00Z' }] }), []);
});

test('greenWindow finds the cleanest 30-min slot in 24h', () => {
  const w = carbon.greenWindow(slots, { durationMin: 30, horizonH: 24, now: NOW });
  assert.strictEqual(w.now.avgGPerKWh, 98);
  assert.strictEqual(w.best.avgGPerKWh, 43);
  assert.strictEqual(w.best.start, '2026-10-23T21:30:00.000Z');
  assert.strictEqual(w.waitMin, 795);
  assert.strictEqual(w.savingPct, 56.1);
});

test('greenWindow averages multi-slot durations', () => {
  const w = carbon.greenWindow(slots, { durationMin: 90, horizonH: 24, now: NOW });
  assert.ok(w.best.avgGPerKWh >= 43 && w.best.avgGPerKWh < 45);
});

test('greenWindow respects the horizon', () => {
  const w = carbon.greenWindow(slots, { durationMin: 30, horizonH: 6, now: NOW });
  assert.strictEqual(w.best.avgGPerKWh, 82);
  assert.ok(w.waitMin <= 360);
});

test('greenWindow rejects empty data and bad options', () => {
  assert.throws(() => carbon.greenWindow([], {}), RangeError);
  assert.throws(() => carbon.greenWindow(slots, { durationMin: 0, now: NOW }), RangeError);
  assert.throws(() => carbon.greenWindow(slots, { durationMin: 48 * 60, now: NOW }), /not enough/);
});

test('decide: run now when the saving is too small', () => {
  const w = carbon.greenWindow(slots, { durationMin: 30, horizonH: 6, now: NOW });
  assert.strictEqual(carbon.decide(w).decision, 'run');
});

test('decide: defer when much cleaner and close enough', () => {
  const w = carbon.greenWindow(slots, { durationMin: 30, horizonH: 14, now: NOW });
  const d = carbon.decide(w, { minSavingPct: 30, maxWaitH: 14 });
  assert.strictEqual(d.decision, 'defer');
  assert.match(d.reason, /cleaner/);
});

test('decide: never defer beyond maxWaitH', () => {
  const w = carbon.greenWindow(slots, { durationMin: 30, horizonH: 24, now: NOW });
  assert.strictEqual(carbon.decide(w, { maxWaitH: 6 }).decision, 'run');
});

test('sci follows E x I with M excluded', () => {
  const r = carbon.sci({ minutes: 10, watts: 30, gPerKWh: 98 });
  assert.strictEqual(r.E_kWh, 0.005);
  assert.strictEqual(r.SCI_g_per_run, 0.49);
  assert.throws(() => carbon.sci({ minutes: -1, watts: 30, gPerKWh: 1 }), RangeError);
});

test('fetchForecast builds the fw24h URL and parses', async () => {
  let called;
  const s = await carbon.fetchForecast({ now: NOW, fetchImpl: async (u) => { called = u; return { ok: true, json: async () => fixture }; } });
  assert.strictEqual(called, 'https://api.carbonintensity.org.uk/intensity/2026-10-23T08:00Z/fw24h');
  assert.strictEqual(s.length, 49);
});

test('fetchForecast surfaces upstream errors', async () => {
  await assert.rejects(carbon.fetchForecast({ fetchImpl: async () => ({ ok: false, status: 502 }) }), /HTTP 502/);
});
