# Changelog

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
