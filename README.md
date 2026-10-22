# ☀️ SunGate — solar-aware, agent-run path to production

**GitLab Transcend "Life After Code" hackathon · Path A: Start Fresh · Autonomy: Supervised**

SunGate is a tiny solar-output forecast API for small solar/DePIN operators.
The real project is everything *after* the code: GitLab Duo Agent Platform flows plan, build, review,
secure, fix, release and watch the app. A human approves only the production outcome.
CI checks grid carbon first (SCI, ISO/IEC 21031) and defers heavy jobs when the grid is dirty.

## Stages covered (9/9)
| Stage | What runs |
|---|---|
| plan | `01-issue-to-mr` flow: reads issue, posts plan + acceptance criteria |
| create | same flow writes code + tests, opens MR |
| verify | `lint`, `test` (JUnit), `03-pipeline-doctor` fixes failed pipelines |
| package | `build-image` → GitLab Container Registry |
| secure | SAST, Secret Detection, Dependency + Container Scanning; `02-mr-guardian` fixes high findings |
| release | tag → `release` job; `04-release-and-incident` writes changelog MR |
| configure | `.gitlab/duo/agent-config.yml`, Cloud Run config in `deploy/` |
| monitor | `smoke-staging`, scheduled `monitor-production`; failure → incident issue with rollback |
| govern | `governance-check` (MIT, CODEOWNERS), manual prod gate, carbon gate |

## Run locally
```
npm test && npm run lint && npm start   # http://localhost:8080
```
API: `GET /api/forecast?lat=50.45&lon=30.52&hours=24`, `GET /healthz`.

## Duo setup
1. Import flows from `.gitlab/duo/flows/` in Automate → Flows (AI Catalog), enable in project.
2. Triggers: issue mention/assign → 01, MR reviewer → 02, pipeline failed → 03, tag/schedule → 04.
3. CI vars for Google Cloud bonus: `GCP_PROJECT`, `GCP_REGION`, `GCP_SA_KEY` (file, masked), `STAGING_URL`, `PROD_URL`.

## Sustainability
`scripts/sci.js` computes SCI = (E × I + M) per pipeline run. Assumptions are env vars, not hidden.
Cloud Run scales to zero (`--min-instances 0`), the image is node:20-alpine with zero npm deps.

License: MIT.
