# ☀️ SunGate: a carbon-aware path to production, run by GitLab Duo flows

**GitLab AI Hackathon "Transcend" (Life After Code) · Path A: Start Fresh · Autonomy level: Supervised**

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
GET /api/forecast?lat=50.45&lon=30.52&hours=24&area=1.6     # clear-sky PV forecast
GET /api/green-window?duration=60&horizon=24                 # cleanest window on the GB grid
```
Invalid input returns HTTP 400. The web page runs the same `solar.js` and `carbon.js` in the browser,
so the production site works as a static GitLab Pages site.

## Run locally

```
node --test test/*.test.js     # 31 tests, offline (real grid data fixture)
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
