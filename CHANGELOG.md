# Changelog

## 1.0.1
- Fix: the GitLab Pages page loads `solar.js` and `carbon.js` as classic scripts in one global scope.
  Both files declared a top-level `const api`, so the second script failed and the green-window card showed
  "SunGateCarbon is not defined". The exports are now block-scoped.
- New regression test `test/browser-bundle.test.js` runs both files in one shared VM context, like the browser does.
- The production monitor (`scripts/smoke.js`, static mode) now runs the deployed scripts the same way, so a page
  that returns 200 but cannot run fails the monitor.
- The page has a tilt input (the `tilt` parameter added by the Issue to MR flow in MR !1), a deployed-commit line and evidence links.

## 1.0.0
- Carbon-aware pipeline: carbon gate (advise/enforce), heavy work in a dynamic child pipeline,
  time-shifting with GitLab delayed jobs, measured SCI report per pipeline run.
- New `/api/green-window` endpoint and green-window card on the web page (GB grid data).
- Four Duo Agent Platform flows: Issue→MR, MR Guardian, Pipeline Doctor (fix or incident), Release Captain.
- Guardrails as code (`scripts/governance.js`), `AGENTS.md`, project skills, CODEOWNERS on automation.
- Ephemeral staging: the built image is booted as a CI service and smoke-tested.
- Production on GitLab Pages behind a manual job; scheduled production monitor.
- Node.js 24 LTS; 31 offline tests.

## 0.1.0
- Initial SunGate: solar forecast API, first pipeline and flows.
