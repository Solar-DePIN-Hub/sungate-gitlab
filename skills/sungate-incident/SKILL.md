---
name: sungate-incident
description: Runbook for SunGate production incidents raised by the scheduled monitor-production job. Use when monitor-production fails.
---
# SunGate incident runbook

1. Read the `monitor-production` job log: failing checks, HTTP status, latency (limit 1500 ms).
2. Reuse an open `incident::open` issue if there is one; otherwise create `Incident: production check failed <UTC time>`
   with labels `incident::open`, `severity::2` (`severity::1` if the page or `/healthz` is down).
3. Include: failing checks, last deployed commit (Deploy > Environments > production), suspected cause, rollback steps.
4. Rollback (human only): Deploy > Environments > production > last good deployment > Re-deploy,
   or revert the bad commit by merge request and play the `pages` job.
5. Never deploy, roll back or change CI variables yourself.
