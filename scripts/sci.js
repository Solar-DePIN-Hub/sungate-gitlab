'use strict';
// Software Carbon Intensity (Green Software Foundation SCI spec, ISO/IEC 21031:2024):
//   SCI = ((E * I) + M) per R
// E = energy (kWh) of the pipeline, I = grid carbon intensity (gCO2e/kWh), M = embodied (ignored: shared runners), R = one pipeline run.
// Inputs come from env so the carbon gate is transparent and auditable. Defaults are illustrative, documented assumptions.
const runnerWatts = Number(process.env.RUNNER_WATTS || 30);        // assumed avg draw of a shared runner vCPU slice
const minutes = Number(process.env.PIPELINE_MINUTES || 6);
const intensity = Number(process.env.GRID_INTENSITY_G_PER_KWH || 300);
const threshold = Number(process.env.CARBON_THRESHOLD_G_PER_KWH || 400);
const E = (runnerWatts * minutes) / 60 / 1000;
const sci = E * intensity;
const report = { spec: 'GSF SCI v1.0', E_kWh: +E.toFixed(5), I_gCO2e_per_kWh: intensity, SCI_gCO2e_per_run: +sci.toFixed(3), threshold, decision: intensity <= threshold ? 'run-heavy-jobs' : 'defer-heavy-jobs' };
require('node:fs').writeFileSync('sci-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (process.argv.includes('--gate') && report.decision !== 'run-heavy-jobs') { console.error('Grid too dirty now: deferring heavy jobs'); process.exit(3); }
