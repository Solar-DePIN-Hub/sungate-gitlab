'use strict';
// Final pipeline job: measured Software Carbon Intensity for this pipeline run.
// E = measured wall-clock minutes (pipeline created -> now) x RUNNER_WATTS (stated assumption).
// I = live grid intensity captured by the carbon gate. M = 0 (shared runners, stated assumption).
const fs = require('node:fs');
const { sci } = require('../src/carbon');
const env = process.env;
const gate = fs.existsSync('carbon-report.json') ? JSON.parse(fs.readFileSync('carbon-report.json', 'utf8')) : null;
const created = Date.parse(env.CI_PIPELINE_CREATED_AT || '');
const deferred = Boolean(gate && gate.effective === 'deferred');
// When heavy work was time-shifted, the delayed wait holds no runner, so it is not energy: subtract it.
const waitMin = deferred ? gate.window.waitMin : 0;
const minutes = Number.isFinite(created) ? Math.max(0.1, (Date.now() - created) / 60e3 - waitMin) : Number(env.PIPELINE_MINUTES || 10);
const watts = Number(env.RUNNER_WATTS || 30);
// Deferred runs execute in the green window, so they are charged at that window's intensity.
const iNow = gate ? (deferred ? gate.window.best.avgGPerKWh : gate.window.now.avgGPerKWh) : Number(env.CARBON_FALLBACK_G_PER_KWH || 200);
const iBest = gate ? gate.window24h.best.avgGPerKWh : iNow;
const report = {
  pipeline: env.CI_PIPELINE_URL || 'local',
  commit: env.CI_COMMIT_SHORT_SHA || 'local',
  measured: { pipelineMinutes: +minutes.toFixed(2), note: 'wall-clock from pipeline creation to this job' },
  assumptions: { RUNNER_WATTS: watts, M: 'excluded (shared runners)', R: 'one pipeline run' },
  sci: sci({ minutes, watts, gPerKWh: iNow }),
  greenest: sci({ minutes, watts, gPerKWh: iBest }),
  window24h: gate ? gate.window24h : null,
  gate: gate ? { mode: gate.mode, effective: gate.effective, reason: gate.gate.reason } : null,
};
fs.writeFileSync('sci-report.json', JSON.stringify(report, null, 2));
// GitLab metrics report (shown in the MR widget on Premium/Ultimate)
fs.writeFileSync('metrics.txt', `sci_g_per_run ${report.sci.SCI_g_per_run}\npipeline_minutes ${report.measured.pipelineMinutes}\ngrid_g_per_kwh ${iNow}\n`);
console.log(JSON.stringify(report, null, 2));
