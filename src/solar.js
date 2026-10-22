'use strict';
// Pure solar math, no dependencies.
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

// Solar elevation for lat/lon at a UTC Date (NOAA-style simplified).
function solarElevation(lat, lon, date) {
  const rad = Math.PI / 180;
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (day - 81));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15;
  const hourAngle = 15 * (hours - 12);
  const s = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(hourAngle * rad);
  return +(Math.asin(s) / rad).toFixed(2);
}

function forecast({ lat, lon, areaM2 = 1.6, efficiency = 0.2, start = new Date(), hours = 24 }) {
  const out = [];
  const t0 = new Date(start); t0.setUTCMinutes(0, 0, 0);
  for (let h = 0; h < hours; h++) {
    const t = new Date(t0.getTime() + h * 3600e3);
    const elev = solarElevation(lat, lon, t);
    const irr = clearSkyIrradiance(elev);
    out.push({ time: t.toISOString(), elevationDeg: elev, irradianceWm2: irr, powerW: pvPowerW({ areaM2, efficiency, irradianceWm2: irr }) });
  }
  return { lat, lon, areaM2, efficiency, energyWh: +out.reduce((a, p) => a + p.powerW, 0).toFixed(1), hourly: out };
}

module.exports = { pvPowerW, clearSkyIrradiance, solarElevation, forecast };
