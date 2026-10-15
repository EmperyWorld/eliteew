# UltimateDocEditor Ops Runbook

Runbook for incident triage and recovery in UltimateDocEditor.

## 1) Incident Intake

Capture immediately:

- user impact (who/what broken),
- start time and current status,
- latest deploy hash/build,
- reproducible steps.

## 2) Fast Health Checks

- Frontend build status and static asset availability.
- Editor open path and save path behavior.
- Comments deep-link behavior (`thread=<id>`).
- Draft recovery modal behavior.
- Template catalog source (`db` vs `fallback`) and `degradedReason`.
- Plugin catalog source (`db` vs `fallback`) and `degradedReason`.
- AI streaming controls (`Остановить`) and partial response integrity.
- AI pre-insert policy endpoint (`/api/doc-editor/ai/pre-insert-check`) warnings/allow decision.
- Server draft endpoints (`GET/PUT/DELETE /api/doc-editor/documents/{id}/draft`) and 409 conflict payloads.
- Catalog audit table writes (`doc_editor_catalog_audit_log`) for plugin admin actions.

## 3) Triage by Symptom

### A. Editor does not open

- Check console runtime errors.
- Verify lazy chunks are loading (network and 200 status).
- Rollback if broad impact is confirmed.

### B. Save flow is broken

- Check API request/response errors.
- Confirm auth token state and retry behavior.
- If persistent across users, rollback frontend.

### C. Comments/deep-link broken

- Validate hash lifecycle:
  - parse `thread`,
  - open comments panel,
  - clear hash after successful navigation.
- Run `threadHashLink` tests locally for regression signal.
- If API returns 503 with missing table detail, apply DB migration before retry.

### D. Draft recovery inconsistencies

- Check local draft telemetry:
  - conflict detected/opened/restored/skipped/discarded.
- Inspect cleanup metrics for abnormal stale/corrupt removals.
- If restore path is unsafe, instruct users to keep server version and rollback.

### E. Templates/plugins degraded mode

- Check `/api/doc-editor/templates` and `/api/doc-editor/plugins` response fields:
  - `source`,
  - `degradedReason`.
- If `schema_missing_*` appears:
  - verify pending migrations applied,
  - rerun API health checks.
- If DB query errors persist without schema issues:
  - collect backend stacktrace,
  - switch canary off for affected cohort until fixed.

### F. AI stream stop/provenance mismatch

- Validate SSE stream structure:
  - `data: {"meta": ...}` arrives before text chunks,
  - `[DONE]` closes stream.
- Verify user stop action sends client abort and UI shows stop state cleanly.
- If aborted requests continue producing chunks, treat as P1 and rollback canary.

### G. Server draft conflicts spike

- Inspect `document_version_conflict` and `draft_version_conflict` rates.
- Verify clients pass `expected_version` and `expected_draft_version`.
- If conflict storm appears after deploy, disable canary and revert draft autosave patch.

## 4.1) Logs / alerts (без stack3)

- **stack3 / VictoriaLogs снят** — см. `platform/docker-re_doc/AGENT-LOGS-QUICKREF.md`.
- Query baseline (файл лога или `podman logs`):
  - `rg -i 'doc_editor.*(ERROR|WARN)' eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod/]* | tail -50`
- Track counters:
  - `doc_editor.permissions.denied`
  - `doc_editor.ai.policy_blocked`
  - `doc_editor.drafts.server_conflict`
  - `doc_editor.catalog.audit_write_failed`

## 4) Decision Matrix

- **P0 / data risk:** immediate rollback.
- **P1 / major workflow blocked:** rollback unless hotfix < 30 min.
- **P2 / degraded UX only:** continue canary with monitored hotfix.
- **Schema missing / degraded catalog**: P1 by default; escalate to P0 if install/apply actions are blocked for most users.

## 5) Recovery and Validation

After fix or rollback:

- Re-run smoke flow:
  - open editor -> edit -> save;
  - open comments -> jump to anchor;
  - open draft recovery and verify actions;
  - open templates/plugins panels and verify non-degraded state;
  - run AI request, stop generation, and verify no UI lock.
- Confirm error rate returns to baseline.

## 6) Postmortem Checklist

- Root cause and trigger documented.
- Detection gap and prevention action assigned.
- Test coverage added for missed regression path.
