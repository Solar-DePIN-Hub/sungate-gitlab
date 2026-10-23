'use strict';
// Preloaded with `node -r` in tests: replaces global fetch for the carbon API with the saved real GB fixture.
const fixture = require('../fixtures/uk-fw24h.json');
const mode = process.env.MOCK_FETCH || 'ok';
globalThis.fetch = async (url) => {
  if (!String(url).startsWith('https://api.carbonintensity.org.uk/')) throw new Error(`unexpected fetch ${url}`);
  if (mode === 'down') throw new Error('network down');
  return { ok: true, status: 200, json: async () => fixture };
};
if (process.env.MOCK_NOW) {
  const fixed = Date.parse(process.env.MOCK_NOW); const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  };
}
