'use strict';
// End-to-end tests of the CI scripts, offline: the real GB fixture replaces the network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const MOCK = path.join(__dirname, 'helpers', 'mock-fetch.js');

function run(script, env) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sungate-'));
  const r = spawnSync(process.execPath, ['-r', MOCK, path.join(ROOT, 'scripts', script)], {
    cwd, encoding: 'utf8', env: { PATH: process.env.PATH, MOCK_NOW: '2026-10-23T08:15:00Z', ...env },
  });
  return { ...r, cwd, read: f => fs.readFileSync(path.join(cwd, f), 'utf8') };
}

test('carbon gate advise mode always runs heavy jobs', () => {
  const r = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'push' });
  assert.strictEqual(r.status, 0, r.stderr);
  const rep = JSON.parse(r.read('carbon-report.json'));
  assert.strictEqual(rep.mode, 'advise');
  assert.strictEqual(rep.effective, 'run');
  assert.strictEqual(rep.window24h.best.avgGPerKWh, 43);
  assert.match(r.read('carbon.env'), /CARBON_SAVING_PCT=56.1/);
  assert.match(r.read('heavy.yml'), /build-image:/);
  assert.doesNotMatch(r.read('heavy.yml'), /green-window-wait/);
});

test('carbon gate enforce mode time-shifts heavy jobs with a delayed job', () => {
  const r = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'schedule', CARBON_MAX_WAIT_H: '14' });
  assert.strictEqual(r.status, 0, r.stderr);
  const heavy = r.read('heavy.yml');
  assert.match(heavy, /stages: \[green-wait, build, test, staging\]/);
  assert.match(heavy, /- when: delayed\n      start_in: 795 minutes/);
  assert.match(heavy, /build-image:/, 'the real jobs still run, just later');
});

test('every heavy child job has explicit rules (MR-pipeline children skip jobs without rules)', () => {
  const r = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'schedule', CARBON_MAX_WAIT_H: '14' });
  const heavy = r.read('heavy.yml');
  const jobs = heavy.split(/\n(?=[a-z][\w-]*:\s*\n)/).slice(1);
  const names = jobs.map(j => j.split(':')[0]);
  for (const name of ['build-image', 'container_scanning', 'staging-smoke', 'green-window-wait']) {
    assert.ok(names.includes(name), `job ${name} exists`);
  }
  for (const j of jobs) {
    const name = j.split(':')[0];
    if (['stages', 'include', 'variables'].includes(name)) continue;
    assert.match(j, /\n  (rules:|extends: \.always)/, `job ${name} needs rules`);
  }
});

test('[urgent] commit overrides enforce mode', () => {
  const r = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'schedule', CARBON_MAX_WAIT_H: '14', CI_COMMIT_TITLE: 'fix: hotfix [urgent]' });
  assert.strictEqual(JSON.parse(r.read('carbon-report.json')).effective, 'run');
});

test('carbon gate fails open when the grid API is down', () => {
  const r = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'schedule', MOCK_FETCH: 'down' });
  assert.strictEqual(r.status, 0, r.stderr);
  const rep = JSON.parse(r.read('carbon-report.json'));
  assert.strictEqual(rep.effective, 'run');
  assert.match(rep.gate.reason, /unavailable/);
});

test('sci report uses measured minutes and gate intensity', () => {
  const g = run('carbon-gate.js', { CI_PIPELINE_SOURCE: 'push' });
  const r = spawnSync(process.execPath, ['-r', MOCK, path.join(ROOT, 'scripts', 'sci-report.js')], {
    cwd: g.cwd, encoding: 'utf8',
    env: { PATH: process.env.PATH, MOCK_NOW: '2026-10-23T08:15:00Z', CI_PIPELINE_CREATED_AT: '2026-10-23T08:05:00Z', RUNNER_WATTS: '30' },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const rep = JSON.parse(g.read('sci-report.json'));
  assert.strictEqual(rep.measured.pipelineMinutes, 10);
  assert.strictEqual(rep.sci.SCI_g_per_run, 0.49);
  assert.strictEqual(rep.greenest.SCI_g_per_run, 0.215);
  assert.match(g.read('metrics.txt'), /sci_g_per_run 0.49/);
});

test('governance rules pass on this repo', () => {
  const out = execFileSync(process.execPath, ['scripts/governance.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /governance ok/);
  fs.rmSync(path.join(ROOT, 'governance-report.json'), { force: true });
});
