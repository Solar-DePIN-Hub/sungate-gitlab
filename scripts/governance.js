'use strict';
// GOVERN: AI guardrails and compliance as code. Fails the pipeline if any rule is broken.
//  - MIT license present (hackathon + open source requirement)
//  - CODEOWNERS protects CI config, flows and agent config (humans own the automation)
//  - every Duo flow is valid-looking v1 YAML, ambient, and never gets destructive tools
//  - production deploy stays a manual job (Supervised autonomy)
const fs = require('node:fs');
const path = require('node:path');

const FORBIDDEN_TOOLS = ['dismiss_vulnerability', 'update_vulnerability_severity', 'revert_to_detected_vulnerability', 'start_flow'];
const FLOW_DIR = '.gitlab/duo/flows';
const results = [];
const rule = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const read = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

rule('MIT license', /MIT License/.test(read('LICENSE')));
const owners = read('.gitlab/CODEOWNERS');
for (const p of ['/.gitlab-ci.yml', '/.gitlab/', '/ci/', '/scripts/governance.js']) rule(`CODEOWNERS covers ${p}`, owners.split('\n').some(l => l.trim().startsWith(p)));
rule('agent-config present', fs.existsSync('.gitlab/duo/agent-config.yml'));
rule('AGENTS.md present', fs.existsSync('AGENTS.md'));

const flows = fs.existsSync(FLOW_DIR) ? fs.readdirSync(FLOW_DIR).filter(f => f.endsWith('.yml')) : [];
rule('at least 4 Duo flows', flows.length >= 4, `${flows.length} found`);
for (const f of flows) {
  const y = read(path.join(FLOW_DIR, f));
  rule(`${f}: version v1`, /^version:\s*"?v1"?\s*$/m.test(y));
  rule(`${f}: ambient environment`, /^environment:\s*ambient\s*$/m.test(y));
  rule(`${f}: no top-level name/description (rejected by custom flows)`, !/^(name|description|product_group):/m.test(y));
  rule(`${f}: has entry_point`, /^\s+entry_point:/m.test(y));
  const bad = FORBIDDEN_TOOLS.filter(t => new RegExp(`^\\s*-\\s*"?${t}"?\\s*:?\\s*$`, 'm').test(y));
  rule(`${f}: no destructive tools`, bad.length === 0, bad.join(', '));
  rule(`${f}: no tabs`, !/\t/.test(y));
}

const ci = read('.gitlab-ci.yml');
const pages = ci.slice(ci.indexOf('\npages:'), ci.indexOf('\n', ci.indexOf('allow_failure: true', ci.indexOf('\npages:'))));
rule('production deploy is manual (human gate)', /when: manual/.test(pages));
rule('no secrets in repo config', !/(glpat-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(ci + read('.gitlab/duo/agent-config.yml')));

fs.writeFileSync('governance-report.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `${failed} governance rule(s) failed` : `governance ok: ${results.length} rules`);
process.exit(failed ? 1 : 0);
