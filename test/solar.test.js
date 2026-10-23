'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pvPowerW, clearSkyIrradiance, solarElevation, solarAzimuth, tiltFactor, forecast } = require('../src/solar');

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

test('forecast with tilt 0 equals forecast without tilt', () => {
  const a = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-12-21T00:00:00Z') });
  const b = forecast({ lat: 50.45, lon: 30.52, start: new Date('2026-12-21T00:00:00Z'), tilt: 0 });
  assert.deepStrictEqual(b.hourly, a.hourly);
  assert.strictEqual(b.energyWh, a.energyWh);
  assert.strictEqual(b.tilt, 0);
});
test('tilted panel beats flat panel on a Kyiv winter day', () => {
  const start = new Date('2026-12-21T00:00:00Z');
  const flat = forecast({ lat: 50.45, lon: 30.52, start });
  const tilted = forecast({ lat: 50.45, lon: 30.52, start, tilt: 30 });
  assert.strictEqual(tilted.tilt, 30);
  assert.ok(tilted.energyWh > flat.energyWh);
});
test('forecast rejects invalid tilt', () => {
  for (const tilt of [-1, 91, NaN, 'x']) assert.throws(() => forecast({ lat: 50, lon: 30, tilt }), RangeError, String(tilt));
});
test('solar azimuth is roughly south at solar noon in the northern mid-latitudes', () => {
  const az = solarAzimuth(50, 0, new Date('2026-03-20T12:00:00Z'));
  assert.ok(Math.abs(az - 180) < 5, String(az));
  assert.ok(solarAzimuth(50, 0, new Date('2026-03-20T08:00:00Z')) < 180);
  assert.ok(solarAzimuth(50, 0, new Date('2026-03-20T16:00:00Z')) > 180);
});
test('tiltFactor is 1 at tilt 0 and bounded', () => {
  assert.strictEqual(tiltFactor(40, 150, 0, 50), 1);
  for (const elev of [0.5, 5, 20, 45, 80]) for (const az of [0, 90, 180, 270]) for (const tilt of [10, 30, 60, 90]) {
    const f = tiltFactor(elev, az, tilt, 50);
    assert.ok(f >= 0 && f <= 5, `${elev} ${az} ${tilt} ${f}`);
  }
});
