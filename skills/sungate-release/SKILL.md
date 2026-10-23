---
name: sungate-release
description: Checklist and wording for a SunGate release readiness report, including carbon (SCI) numbers. Use when a default-branch or tag pipeline passed.
---
# SunGate release readiness

1. Pipeline: every job in the parent pipeline and the `heavy` child pipeline passed (or `carbon-deferred` explains the wait).
2. Quality: `test` job (node --test, coverage) and `lint` passed; `governance` passed.
3. Security: no open critical/high findings from SAST, Secret Detection, Dependency Scanning, Container Scanning.
4. Staging: `staging-smoke` booted the exact image built in this pipeline and all checks passed.
5. Carbon: from `sci-report.json` quote `sci.SCI_g_per_run` (grams CO2e per pipeline run), grid intensity now, and the greenest
   window in the next 24 h with the possible saving.
6. Governance: list actions by AI service accounts (`ai-*`) from the project audit events.
7. Decision line, exactly one of:
   - `READY: a maintainer can press play on the pages job: <url>`
   - `NOT READY: <reasons>`
