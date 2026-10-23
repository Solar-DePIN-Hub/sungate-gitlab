# Sustainability: how SunGate measures and cuts pipeline carbon

## Method: Software Carbon Intensity (SCI)
Green Software Foundation SCI specification (ISO/IEC 21031:2024): **SCI = (E × I + M) per R**

| Term | SunGate value | Source |
|---|---|---|
| R (functional unit) | one pipeline run | fixed |
| E (energy, kWh) | measured pipeline minutes × `RUNNER_WATTS` ÷ 60 000 | minutes measured in CI (`CI_PIPELINE_CREATED_AT` → `sci-report`); 30 W per runner is a **stated assumption** you can change |
| I (gCO₂e/kWh) | live grid intensity at run time | National Grid ESO Carbon Intensity API, GB, captured by `carbon-gate` |
| M (embodied) | excluded | shared SaaS runners; stated in every report |

Each pipeline publishes `sci-report.json`, a GitLab metrics report (`sci_g_per_run`), and the number on
the production page. Time spent waiting in a delayed job is not counted (no runner is held).

## Reduction: carbon-aware time shifting
Heavy work (Docker build, container scanning, ephemeral staging) lives in a child pipeline.
For scheduled pipelines the carbon gate delays it to the cleanest window within 6 hours when that
window is at least 30 % cleaner. Developer pipelines are never delayed; they get advice.

## Real example (GB grid forecast captured 2026-10-23 08:15 UTC, saved in `test/fixtures/uk-fw24h.json`)
- Intensity at 08:00 UTC: **98 gCO₂e/kWh**; cleanest 30-min slot in 24 h: **43 gCO₂e/kWh** at 21:30 UTC.
- Possible cut: **56 %** per run moved to that slot.
- A 10-minute pipeline at 30 W: E = 0.005 kWh → **0.49 g CO₂e now vs 0.215 g** in the green window.

These grams are small per run; the point is the method. It is the same for heavier CI (GPU tests,
large builds), where E is hundreds of times larger and the percentage cut stays the same.

## Other choices
- Zero npm dependencies, small Alpine image, Node.js 24 LTS.
- Production is a static GitLab Pages site (no always-on server). Optional Cloud Run uses
  `--min-instances 0` and region `europe-north1`, which Google marks as "Low CO2".
- The API caches grid data for 15 minutes; the monitor probe runs every 30 minutes and only does 3 small requests.

## Limits (honest)
- Grid data is for Great Britain only. GitLab SaaS runners do not publish their location or power use,
  so I uses GB as a public proxy, and runner power is an assumption.
- SCI here covers the pipeline, not end users of the API.
