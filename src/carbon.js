'use strict';
// Carbon-aware scheduling core. Shared by the SunGate API (/api/green-window) and by the
// CI carbon gate (scripts/carbon-gate.js), so the pipeline runs on the same code it ships.
//
// Data source: GB National Grid ESO Carbon Intensity API (public, no key, CC BY 4.0).
//   https://carbonintensity.org.uk  ·  48 half-hour slots of forecast gCO2e/kWh.
// SCI (Green Software Foundation, ISO/IEC 21031:2024): SCI = ((E * I) + M) per R.

const API = 'https://api.carbonintensity.org.uk';
const SLOT_MIN = 30;

/** Normalise the upstream payload into [{from, to, gPerKWh}] sorted by time. */
function parseSlots(payload) {
  const rows = payload && Array.isArray(payload.data) ? payload.data : [];
  const out = [];
  for (const r of rows) {
    const i = r && r.intensity ? (r.intensity.actual ?? r.intensity.forecast) : null;
    if (!r || typeof r.from !== 'string' || !Number.isFinite(i)) continue;
    const from = new Date(r.from.replace(/Z?$/, 'Z'));
    if (Number.isNaN(from.getTime())) continue;
    out.push({ from: from.toISOString(), to: new Date(from.getTime() + SLOT_MIN * 60e3).toISOString(), gPerKWh: i });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Find the lowest-carbon contiguous window of `durationMin` within the next `horizonH` hours.
 * Returns { now, best, savingPct } where now/best are { start, avgGPerKWh }.
 */
function greenWindow(slots, { durationMin = 30, horizonH = 24, now = new Date() } = {}) {
  if (!Array.isArray(slots) || slots.length === 0) throw new RangeError('no carbon intensity data');
  if (!(durationMin > 0) || !(horizonH > 0)) throw new RangeError('durationMin and horizonH must be > 0');
  const need = Math.max(1, Math.ceil(durationMin / SLOT_MIN));
  const t0 = now.getTime() - SLOT_MIN * 60e3; // include the slot we are in
  const end = now.getTime() + horizonH * 3600e3;
  const s = slots.filter(x => { const t = Date.parse(x.from); return t > t0 && t < end; });
  if (s.length < need) throw new RangeError('not enough forecast data for that duration');
  const avg = i => s.slice(i, i + need).reduce((a, x) => a + x.gPerKWh, 0) / need;
  let bestI = 0, bestV = avg(0);
  for (let i = 1; i + need <= s.length; i++) { const v = avg(i); if (v < bestV) { bestV = v; bestI = i; } }
  const nowV = avg(0);
  return {
    durationMin, horizonH,
    now: { start: s[0].from, avgGPerKWh: +nowV.toFixed(1) },
    best: { start: s[bestI].from, avgGPerKWh: +bestV.toFixed(1) },
    waitMin: Math.max(0, Math.round((Date.parse(s[bestI].from) - now.getTime()) / 60e3)),
    savingPct: nowV > 0 ? +(((nowV - bestV) / nowV) * 100).toFixed(1) : 0,
  };
}

/**
 * Gate decision. Defer heavy work only when waiting is worth it and not too long.
 *  - minSavingPct: defer only if the best window is at least this much cleaner (default 30%)
 *  - maxWaitH: never push work further than this (default 6h)
 */
function decide(win, { minSavingPct = 30, maxWaitH = 6 } = {}) {
  const worth = win.savingPct >= minSavingPct && win.waitMin <= maxWaitH * 60 && win.waitMin > 0;
  return { decision: worth ? 'defer' : 'run', reason: worth
    ? `grid ${win.savingPct}% cleaner in ${win.waitMin} min (${win.best.avgGPerKWh} vs ${win.now.avgGPerKWh} gCO2e/kWh)`
    : `running now: best window saves ${win.savingPct}% and is ${win.waitMin} min away (threshold ${minSavingPct}% within ${maxWaitH}h)` };
}

/** SCI for one pipeline run. E from measured minutes x assumed runner power. M excluded (shared runners). */
function sci({ minutes, watts, gPerKWh }) {
  for (const [k, v] of Object.entries({ minutes, watts, gPerKWh })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a non-negative number`);
  }
  const E = (watts * minutes) / 60 / 1000;
  return { E_kWh: +E.toFixed(6), I_gCO2e_per_kWh: gPerKWh, M_g: 0, R: 'one pipeline run', SCI_g_per_run: +(E * gPerKWh).toFixed(4) };
}

/** Fetch the 24h forward forecast. fetchImpl is injectable for tests. */
async function fetchForecast({ fetchImpl = globalThis.fetch, now = new Date(), timeoutMs = 5000 } = {}) {
  const ts = new Date(Math.floor(now.getTime() / (SLOT_MIN * 60e3)) * SLOT_MIN * 60e3).toISOString().slice(0, 16) + 'Z';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(`${API}/intensity/${ts}/fw24h`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`carbon API HTTP ${r.status}`);
    return parseSlots(await r.json());
  } finally { clearTimeout(t); }
}

// Block scope: the browser loads solar.js and carbon.js as classic scripts in one global scope,
// so a top-level `const api` in both files would collide ("Identifier 'api' has already been declared").
{
  const api = { parseSlots, greenWindow, decide, sci, fetchForecast, API };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.SunGateCarbon = api;
}
