# ☀️ SunGate: a carbon-aware path to production, run by GitLab Duo flows

**GitLab AI Hackathon "Transcend" (Life After Code) · Path A: Start Fresh · Autonomy level: Supervised**

**Live:** https://showcase-e6d7ff.gitlab.io (GitLab Pages, environment `production`) · **Pipelines:** [gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/pipelines](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/pipelines)

SunGate is a small API and web page for solar owners: it forecasts clear-sky solar output for any
location and finds the next **low-carbon window** on the electricity grid (live GB grid data).

The real project is what happens **after the code is written**. Four GitLab Duo Agent Platform flows
plan, build, review, secure, repair, release and watch SunGate. The pipeline uses **the same carbon
code that SunGate ships**: before heavy CI work (Docker build, container scan, staging), a carbon gate
reads the live grid forecast and, for scheduled work, time-shifts it to a cleaner window.
A human makes one decision: pressing play on the production job.

```
issue ──► [01 Issue→MR] plan + code + tests ──► MR ──► [02 MR Guardian] review + security fixes
                                                          │
                       pipeline: carbon gate ─► lint/test/governance ─► SAST/secrets/deps
                                 └─► heavy child pipeline (time-shifted if the grid is dirty):
                                     docker build ─► container scan ─► ephemeral staging + smoke
                                                          │
   failed ─► [03 Pipeline Doctor] fix MR / incident     passed ─► [04 Release Captain] readiness report
                                                          │
                                  HUMAN presses ▶ pages (production) ─► scheduled monitor every 30 min
```

## Proof it ran (23 October 2026, times UTC)

| What happened | Evidence |
|---|---|
| Issue #4 "Add a tilt parameter" assigned to the **Issue to MR** flow at 08:58:00. The planner posted a plan, acceptance criteria and risk at 08:59:09 | [issue #4](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/work_items/4) |
| The builder opened MR !1 at 09:00:13 (code + 7 tests). The commit author is the flow's service account, `SunGate Issue to MR` | [MR !1](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/merge_requests/1), commit [c37a7479](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/commit/c37a7479) |
| **MR Guardian** requested as reviewer at 09:00:53. Verdict posted at 09:02:05: no critical/high findings. It flagged that the MR pipeline had failed without a failed job. That turned out to be a real CI bug in the child-pipeline rules, fixed in [b61a12e8](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/commit/b61a12e8) | [MR !1 notes](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/merge_requests/1) |
| A human merged MR !1. **Release Captain** posted a readiness report (tests, findings, SCI, AI audit events, the manual production job) | [issue #2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/work_items/2) |
| A deliberately broken push (`feat/hours-zero`, red `test` job). **Pipeline Doctor** diagnosed it, pushed fix commit [2a263c38](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/commit/2a263c38) (author `SunGate Pipeline Doctor`) and opened MR !2, whose pipeline went green. !2 stays open on purpose as a demo | [failed pipeline](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/pipelines/2980332381), [MR !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/merge_requests/2) |
| Production is a manual `pages` job. A schedule probes it every 30 minutes | [schedules](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/pipeline_schedules), [live site](https://showcase-e6d7ff.gitlab.io) |

## The 9 lifecycle stages

| Stage | What does it (file) |
|---|---|
| **Plan** | Flow `01-issue-to-mr`: *planner* agent posts a plan, acceptance criteria and risk on the issue |
| **Create** | Same flow: *builder* agent writes code + tests, runs lint/tests/governance, opens the MR |
| **Verify** | Jobs `lint`, `test` (JUnit + coverage), `governance`; flow `03-pipeline-doctor` diagnoses red pipelines and opens a fix MR (max 2 attempts, then hands over to a human) |
| **Package** | Child pipeline `ci/heavy.yml`: `build-image` pushes to the GitLab Container Registry |
| **Secure** | SAST, Secret Detection, Dependency Scanning (MR pipelines too), Container Scanning; flow `02-mr-guardian` reads the findings, fixes critical/high ones on the MR branch, posts a verdict |
| **Release** | Flow `04-release-captain` posts a release-readiness report; manual `pages` job = production; tags create a GitLab Release |
| **Configure** | `.gitlab/duo/agent-config.yml` (network policy for flows), `ci/heavy.yml` generated per run, `deploy/cloudrun.sh` |
| **Monitor** | `staging-smoke` on an ephemeral staging container; scheduled `monitor-production` every 30 min; a failure → Pipeline Doctor opens an incident issue with a rollback plan |
| **Govern** | `scripts/governance.js` (34 guardrail rules in CI), `AGENTS.md`, CODEOWNERS on all automation, manual production gate, carbon policy, audit events in the readiness report |

## Carbon-aware CI (how the gate works)

`scripts/carbon-gate.js` runs first in every pipeline and uses `src/carbon.js` (also used by the API):

1. Fetches the 24 h forecast of grid carbon intensity (gCO₂e/kWh, half-hour slots) from the
   National Grid ESO Carbon Intensity API (public, no key, CC BY 4.0).
2. Finds the cleanest window for the heavy work within 6 h and within 24 h.
3. Policy:
   - **push / MR pipelines → `advise`**: never slows developers; reports the greener time.
   - **scheduled pipelines → `enforce`**: if a window ≥ 30 % cleaner starts within 6 h, the heavy
     child pipeline gets a GitLab `when: delayed` job, so Docker build, scans and staging start in
     that window. Delayed jobs hold no runner while they wait.
   - `[urgent]` in the commit title always runs now; if the grid API is down the gate fails open.
4. `sci-report` computes Software Carbon Intensity per pipeline run from the **measured** pipeline
   duration and the **live** grid intensity, and compares it with the greenest window.

Details and numbers: [docs/SUSTAINABILITY.md](docs/SUSTAINABILITY.md).

## API

```
GET /healthz
GET /api/forecast?lat=50.45&lon=30.52&hours=24&area=1.6&tilt=0   # clear-sky PV forecast
GET /api/green-window?duration=60&horizon=24                 # cleanest window on the GB grid
```
`tilt` is optional: the panel tilt from horizontal in degrees, 0..90 (default 0, a flat panel). The panel
is assumed to face the equator (south in the northern hemisphere, north in the southern). A `tilt` that is
not a number or is outside 0..90 returns HTTP 400.

Invalid input returns HTTP 400. The web page runs the same `solar.js` and `carbon.js` in the browser,
so the production site works as a static GitLab Pages site.

## Run locally

```
node --test test/*.test.js     # 40 tests, offline (real grid data fixture)
node scripts/lint.js
node scripts/governance.js
node src/server.js             # http://localhost:8080
```
Zero npm dependencies. Node.js 22+ (CI and container use Node.js 24 LTS).

## Duo Agent Platform setup

See [docs/SETUP.md](docs/SETUP.md): create the four flows from `.gitlab/duo/flows/`, add triggers,
add the monitor schedule. Agents follow [AGENTS.md](AGENTS.md) and the skills in `skills/`.

## Human in the loop (why "Supervised")

Agents may open MRs, push fixes to MR branches, comment and open incidents. They may not merge,
deploy to production, roll back, change CI variables, CODEOWNERS, LICENSE or guardrails, or dismiss
vulnerabilities (`scripts/governance.js` fails the pipeline if a flow gets a destructive tool).
Production is the manual `pages` job.

## License

MIT, see [LICENSE](LICENSE). Grid data: National Grid ESO Carbon Intensity API, CC BY 4.0.

---
Workspace note from the hackathon template: Transcend Hackathon Showcase workspace for @solardepin (DevPost: davidbell1603). See the [onboarding issue](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43647382/showcase/-/work_items/1).
