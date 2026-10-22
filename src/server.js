'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { forecast } = require('./solar');
const VERSION = process.env.APP_VERSION || require('../package.json').version;

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, version: VERSION });
  if (url.pathname === '/api/forecast') {
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const hours = Math.min(48, Math.max(1, Number(url.searchParams.get('hours') || 24)));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json(res, 400, { error: 'lat/lon required and must be valid' });
    }
    try { return json(res, 200, forecast({ lat, lon, hours })); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')));
  }
  json(res, 404, { error: 'not found' });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  http.createServer(handler).listen(port, () => console.log(`SunGate ${VERSION} on :${port}`));
}
module.exports = { handler };
