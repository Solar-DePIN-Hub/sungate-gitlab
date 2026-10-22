'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pvPowerW, clearSkyIrradiance, solarElevation, forecast } = require('../src/solar');
const { handler } = require('../src/server');
const http = require('node:http');

test('pv power at STC', () => assert.strictEqual(pvPowerW({ areaM2: 1, efficiency: 0.2, irradianceWm2: 1000 }), 200));
test('pv power rejects bad input', () => assert.throws(() => pvPowerW({ areaM2: -1, efficiency: 0.2, irradianceWm2: 1 })));
test('night gives zero', () => assert.strictEqual(clearSkyIrradiance(-5), 0));
test('noon equator high sun', () => assert.ok(solarElevation(0, 0, new Date('2026-03-20T12:00:00Z')) > 85));
test('forecast 24 points', () => {
  const f = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-06-21T00:00:00Z') });
  assert.strictEqual(f.hourly.length, 24); assert.ok(f.energyWh > 1000);
});
test('http api', async () => {
  const srv = http.createServer(handler).listen(0); const port = srv.address().port;
  const ok = await fetch(`http://127.0.0.1:${port}/api/forecast?lat=50&lon=30&hours=3`);
  assert.strictEqual(ok.status, 200); assert.strictEqual((await ok.json()).hourly.length, 3);
  const bad = await fetch(`http://127.0.0.1:${port}/api/forecast?lat=999&lon=0`);
  assert.strictEqual(bad.status, 400);
  srv.close();
});
