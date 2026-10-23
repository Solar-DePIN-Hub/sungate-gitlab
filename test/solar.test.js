'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pvPowerW, clearSkyIrradiance, solarElevation, forecast } = require('../src/solar');

test('pv power at STC', () => assert.strictEqual(pvPowerW({ areaM2: 1, efficiency: 0.2, irradianceWm2: 1000 }), 200));
test('pv power rejects bad input', () => assert.throws(() => pvPowerW({ areaM2: -1, efficiency: 0.2, irradianceWm2: 1 })));
test('night gives zero', () => assert.strictEqual(clearSkyIrradiance(-5), 0));
test('noon equator high sun', () => assert.ok(solarElevation(0, 0, new Date('2026-03-20T12:00:00Z')) > 85));
test('forecast 24 points for Kyiv midsummer', () => {
  const f = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-06-21T00:00:00Z') });
  assert.strictEqual(f.hourly.length, 24); assert.ok(f.energyWh > 1000);
});
test('winter forecast produces less energy than summer', () => {
  const s = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-06-21T00:00:00Z') });
  const w = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-12-21T00:00:00Z') });
  assert.ok(w.energyWh < s.energyWh);
});
