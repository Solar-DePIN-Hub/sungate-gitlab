# SunGate setup on GitLab (about 15 minutes, Maintainer role)

Project: `gitlab-ai-hackathon/transcend-october-2026/43647382/showcase`.

## 1. Code
Push this repository to the project's default branch (`main`). The first pipeline starts by itself.

## 2. Create the four flows (AI > Flows > New flow)
For each file, paste the whole YAML into the editor. Visibility: **Private** (or Restricted).

| Display name | Description | YAML |
|---|---|---|
| SunGate Issue to MR | Plans an issue, writes code and tests, opens an MR | `.gitlab/duo/flows/01-issue-to-mr.yml` |
| SunGate MR Guardian | Reviews MRs and security findings, fixes critical/high, posts a verdict | `.gitlab/duo/flows/02-mr-guardian.yml` |
| SunGate Pipeline Doctor | Diagnoses failed pipelines: fix MR, retry advice, or incident issue | `.gitlab/duo/flows/03-pipeline-doctor.yml` |
| SunGate Release Captain | Release readiness report for passed default-branch pipelines | `.gitlab/duo/flows/04-release-captain.yml` |

## 3. Enable each flow with its triggers (AI > Flows > Managed > flow > Enable)

| Flow | Event types (Run when) |
|---|---|
| SunGate Issue to MR | Assign, Mention |
| SunGate MR Guardian | Assign reviewer, Mention, Merge request (Created) |
| SunGate Pipeline Doctor | Pipeline events (Failed) |
| SunGate Release Captain | Pipeline events (Passed) |

GitLab creates one service account per flow (`ai-<flow>-<group>`). Note: GitLab only starts triggers
for actions done by a human, so a flow can never trigger itself or another flow in a loop. When flow 01
opens an MR, assign **SunGate MR Guardian** as reviewer to start the review.

## 4. Production monitor schedule (Build > Pipeline schedules > New schedule)
- Description: `SunGate production monitor`
- Interval pattern: custom `*/30 * * * *`, timezone UTC
- Target branch: `main`
- Variable: `SCHEDULE_KIND` = `monitor`

Optional nightly carbon-shifted build: a second schedule `0 1 * * *` with no variables.
Scheduled pipelines use `enforce` mode, so heavy jobs wait for a greener window.

## 5. First production deploy
Open the latest `main` pipeline and press **play** on the `pages` job. The URL appears in
Deploy > Environments > production (and Deploy > Pages).

## 6. Optional
- Google Cloud Run: CI/CD variables `GCP_PROJECT`, `GCP_SA_KEY` (type File, masked, protected),
  optional `GCP_REGION` (default `europe-north1`) and `PROD_URL`. The manual `cloudrun-deploy` job appears.
- Carbon policy: `CARBON_GATE_MODE` (`advise`/`enforce`), `CARBON_MIN_SAVING_PCT` (30),
  `CARBON_MAX_WAIT_H` (6), `RUNNER_WATTS` (30).

## Try it
1. Create an issue, for example: "Add a `tilt` parameter (0..90 degrees) to /api/forecast".
   Assign it to the SunGate Issue to MR service account.
2. The planner posts the plan on the issue; the builder opens an MR with code and tests.
3. Assign SunGate MR Guardian as reviewer; it posts a verdict and fixes critical/high findings.
4. Merge. The `main` pipeline passes; Release Captain posts the readiness report with the `pages` link.
5. Press play on `pages`. The monitor schedule watches production every 30 minutes.
