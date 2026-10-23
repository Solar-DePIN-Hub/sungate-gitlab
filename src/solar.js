'use strict';
// Pure solar math, no dependencies. Shared by the API and the static web UI.
// Simple PV model: P = area * efficiency * irradiance * (1 - temp_loss)
function pvPowerW({ areaM2, efficiency, irradianceWm2, cellTempC = 25 }) {
  for (const [k, v] of Object.entries({ areaM2, efficiency, irradianceWm2 })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a non-negative number`);
  }
  if (efficiency > 1) throw new RangeError('efficiency must be 0..1');
  const tempLoss = Math.max(0, (cellTempC - 25) * 0.004); // ~0.4%/°C typical crystalline Si
  return +(areaM2 * efficiency * irradianceWm2 * (1 - tempLoss)).toFixed(2);
}

// Clear-sky irradiance approximation from solar elevation (degrees).
function clearSkyIrradiance(elevationDeg) {
  if (elevationDeg <= 0) return 0;
  const am = 1 / Math.sin((elevationDeg * Math.PI) / 180); // air mass
  return +(1353 * Math.pow(0.7, Math.pow(am, 0.678))).toFixed(1);
}

// Sun geometry for lat/lon at a UTC Date (NOAA-style simplified): declination and hour angle in degrees, unrounded elevation.
function sunGeometry(lat, lon, date) {
  const rad = Math.PI / 180;
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (day - 81));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15;
  const hourAngle = 15 * (hours - 12);
  const s = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(hourAngle * rad);
  return { decl, hourAngle, elev: Math.asin(s) / rad };
}

// Solar elevation for lat/lon at a UTC Date.
function solarElevation(lat, lon, date) {
  return +sunGeometry(lat, lon, date).elev.toFixed(2);
}

// Solar azimuth in degrees clockwise from north (180 = due south) for lat/lon at a UTC Date.
function solarAzimuth(lat, lon, date) {
  const rad = Math.PI / 180;
  const { decl, hourAngle, elev } = sunGeometry(lat, lon, date);
  const denom = Math.cos(elev * rad) * Math.cos(lat * rad);
  if (Math.abs(denom) < 1e-9) return 180;
  const c = (Math.sin(decl * rad) - Math.sin(elev * rad) * Math.sin(lat * rad)) / denom;
  const az = Math.acos(Math.max(-1, Math.min(1, c))) / rad;
  return +(Math.sin(hourAngle * rad) > 0 ? 360 - az : az).toFixed(2);
}

const TILT_FACTOR_CAP = 5;
// Ratio of irradiance on an equator-facing panel (tilt from horizontal) to irradiance on a flat one.
function tiltFactor(elevDeg, azimuthDeg, tiltDeg, lat) {
  if (elevDeg <= 0) return 0;
  const rad = Math.PI / 180;
  const panelAzimuth = lat >= 0 ? 180 : 0;
  const cosInc = Math.sin(elevDeg * rad) * Math.cos(tiltDeg * rad)
    + Math.cos(elevDeg * rad) * Math.sin(tiltDeg * rad) * Math.cos((azimuthDeg - panelAzimuth) * rad);
  return Math.min(TILT_FACTOR_CAP, Math.max(0, cosInc) / Math.sin(elevDeg * rad));
}

function forecast({ lat, lon, areaM2 = 1.6, efficiency = 0.2, start = new Date(), hours = 24, tilt = 0 }) {
  if (typeof tilt !== 'number' || !Number.isFinite(tilt) || tilt < 0 || tilt > 90) throw new RangeError('tilt must be a number 0..90 degrees');
  const out = [];
  const t0 = new Date(start); t0.setUTCMinutes(0, 0, 0);
  for (let h = 0; h < hours; h++) {
    const t = new Date(t0.getTime() + h * 3600e3);
    const elev = solarElevation(lat, lon, t);
    let irr = clearSkyIrradiance(elev);
    if (tilt !== 0) irr = +(irr * tiltFactor(elev, solarAzimuth(lat, lon, t), tilt, lat)).toFixed(1);
    out.push({ time: t.toISOString(), elevationDeg: elev, irradianceWm2: irr, powerW: pvPowerW({ areaM2, efficiency, irradianceWm2: irr }) });
  }
  return { lat, lon, areaM2, efficiency, tilt, energyWh: +out.reduce((a, p) => a + p.powerW, 0).toFixed(1), hourly: out };
}

// Block scope: the browser loads solar.js and carbon.js as classic scripts in one global scope,
// so a top-level `const api` in both files would collide ("Identifier 'api' has already been declared").
{
  const api = { pvPowerW, clearSkyIrradiance, solarElevation, solarAzimuth, tiltFactor, forecast };
  // Works in Node (API, tests) and in the browser (static GitLab Pages build) without a bundler.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.SunGateSolar = api;
}
