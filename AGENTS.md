# AGENTS.md - rules for every AI agent working on SunGate

SunGate is a solar forecast API with a carbon-aware release pipeline. Node.js 24 LTS, **zero npm dependencies**.

## Project map
- `src/solar.js` - solar position and PV output maths (pure functions, works in Node and browser)
- `src/carbon.js` - grid carbon forecast, green-window search, run/defer decision, SCI maths
- `src/server.js` - HTTP API: `/healthz`, `/api/forecast`, `/api/green-window`, static page
- `scripts/carbon-gate.js` - decides if heavy CI work runs now or waits for a greener window
- `scripts/governance.js` - guardrails as code; must always pass
- `ci/heavy.yml` - carbon-gated child pipeline (docker build, container scan, staging smoke)
- `.gitlab/duo/flows/` - the four SunGate flows

## Commands (run all three before every commit)
```
node scripts/lint.js
node --test test/*.test.js
node scripts/governance.js
```

## Rules
1. Smallest change that solves the task. Add or update tests for every behaviour change.
2. Never weaken, skip or delete a test to make a pipeline pass.
3. Never edit CI/CD variables, secrets, `LICENSE`, `.gitlab/CODEOWNERS` or `scripts/governance.js`. Ask a human.
4. Never dismiss or downgrade a security finding. Fix it or explain it.
5. Heavy CI work (docker, scans, environments) goes in `ci/heavy.yml`, never straight into `.gitlab-ci.yml`.
6. Never add npm dependencies without a human-approved issue.
7. Never deploy to production. Production is the manual `pages` job; a maintainer presses play.
8. Branch names: `duo/<issue-iid>-<slug>` or `duo/fix-ci-<pipeline-id>`. Conventional commit messages.
9. Every query parameter must be validated and return HTTP 400 with a clear message when invalid.

## Incident and rollback (used by Pipeline Doctor)
- Production = GitLab Pages, deployed by the manual `pages` job on the default branch.
- Rollback: open Deploy > Environments > production, pick the last good deployment, press **Re-deploy**
  (or revert the bad commit with a merge request and play `pages` again). A human does this.
- Label incidents `incident::open` + `severity::1|2|3`; close with `incident::resolved` and a short cause note.

## Carbon policy
- Push pipelines: `advise` mode - heavy work always runs; the report shows the greener time.
- Scheduled pipelines: `enforce` mode - heavy work waits if a window within 6 h is at least 30% cleaner.
- `[urgent]` in the commit title always runs now.
