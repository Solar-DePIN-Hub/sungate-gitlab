'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { forecast } = require('./solar');
const carbon = require('./carbon');
const VERSION = process.env.APP_VERSION || require('../package.json').version;
const INDEX = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'));
const ASSETS = { '/solar.js': fs.readFileSync(path.join(__dirname, 'solar.js')), '/carbon.js': fs.readFileSync(path.join(__dirname, 'carbon.js')) };

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

function json(res, code, body, extra = {}) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...extra });
  res.end(JSON.stringify(body));
}

function num(v, def) { if (v === null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : NaN; }

// 15-minute cache so the public API never hammers the upstream grid API.
let cache = { at: 0, slots: null };
async function slots(fetchImpl) {
  if (cache.slots && Date.now() - cache.at < 15 * 60e3) return cache.slots;
  const s = await carbon.fetchForecast({ fetchImpl });
  cache = { at: Date.now(), slots: s };
  return s;
}

function createHandler({ fetchImpl = fetch, clock = () => new Date() } = {}) {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' }, { allow: 'GET, HEAD' });
    if (url.pathname === '/healthz') return json(res, 200, { ok: true, version: VERSION });

    if (url.pathname === '/api/forecast') {
      const lat = num(url.searchParams.get('lat'), NaN);
      const lon = num(url.searchParams.get('lon'), NaN);
      const hours = num(url.searchParams.get('hours'), 24);
      const areaM2 = num(url.searchParams.get('area'), 1.6);
      const tilt = num(url.searchParams.get('tilt'), 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return json(res, 400, { error: 'lat and lon are required: lat -90..90, lon -180..180' });
      }
      if (!Number.isInteger(hours) || hours < 1 || hours > 48) return json(res, 400, { error: 'hours must be an integer 1..48' });
      if (!(areaM2 > 0 && areaM2 <= 10000)) return json(res, 400, { error: 'area must be 0..10000 m2' });
      if (!(tilt >= 0 && tilt <= 90)) return json(res, 400, { error: 'tilt must be a number 0..90 degrees' });
      return json(res, 200, forecast({ lat, lon, hours, areaM2, tilt }));
    }

    if (url.pathname === '/api/green-window') {
      const durationMin = num(url.searchParams.get('duration'), 60);
      const horizonH = num(url.searchParams.get('horizon'), 24);
      if (!Number.isInteger(durationMin) || durationMin < 30 || durationMin > 720) return json(res, 400, { error: 'duration must be minutes 30..720' });
      if (!Number.isInteger(horizonH) || horizonH < 1 || horizonH > 24) return json(res, 400, { error: 'horizon must be hours 1..24' });
      try {
        const w = carbon.greenWindow(await slots(fetchImpl), { durationMin, horizonH, now: clock() });
        return json(res, 200, { region: 'GB', source: 'carbonintensity.org.uk (National Grid ESO, CC BY 4.0)', ...w });
      } catch (e) {
        return json(res, 503, { error: 'carbon data unavailable', detail: e.message });
      }
    }

    if (Object.hasOwn(ASSETS, url.pathname)) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', ...SECURITY_HEADERS });
      return res.end(req.method === 'HEAD' ? undefined : ASSETS[url.pathname]);
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
      return res.end(req.method === 'HEAD' ? undefined : INDEX);
    }
    return json(res, 404, { error: 'not found' });
  };
}

function _resetCache() { cache = { at: 0, slots: null }; }

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  http.createServer(createHandler()).listen(port, () => console.log(`SunGate ${VERSION} listening on :${port}`));
}
module.exports = { createHandler, handler: createHandler(), _resetCache };
