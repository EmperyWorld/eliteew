# UltimateDocEditor Canary Rollout Checklist

Living checklist for safe staged rollout of UltimateDocEditor updates. Product baseline: [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md) §6. Deploy on prod-core only via command-center stack0 line A/B (`platform/PROD-CORE-DEV-BIND-LINE.md`) — never build on `.111`.

## Pre-rollout Gate

- From `shared/web/frontend`: `pnpm run build:react-compiler` (and `pnpm run build:budget` if used in the release gate).
- Critical smoke paths verified:
  - open editor, edit, save;
  - comments panel, anchor jump, deep-link open;
  - local draft recovery (open/restore/discard);
  - templates apply modes (`replace` / `insert` / `append`);
  - plugin panel source badge (`DB` / `Резерв`) and compatibility gating;
  - AI panel streaming with `Остановить` and provenance meta line.
- No new lint errors in changed files.

## Canary Scope

- Start with 5-10% internal users.
- Keep canary through one active work cycle.
- Watch:
  - runtime JS errors,
  - save/recovery regressions,
  - comment anchor latency spikes,
  - template catalog degraded mode (`degradedReason`),
  - plugin catalog degraded mode (`degradedReason`),
  - AI stream abort/cancel error spikes.

## Telemetry Watchlist

- `comment_anchor_decorations_profile`
- `draft_saved_local`
- `draft_conflict_detected`
- `draft_recovery_opened`
- `draft_restored`
- `draft_recovery_skipped`
- `draft_discarded`
- `draft_cleanup_metrics`
- `doc_editor.templates.degraded`
- `doc_editor.plugins.degraded`
- `doc_editor.ai.stream_aborted`
- `doc_editor.ai.stream_failed`
- `doc_editor.ai.policy_blocked`
- `doc_editor.drafts.server_conflict`
- `doc_editor.permissions.denied`
- `doc_editor.catalog.audit_write_failed`

## SLO Dashboard Targets

- Editor load to interactive (`p95`) < 3.5s.
- Draft save ack (`p95`) < 1.2s, conflict rate < 2%.
- AI stream abort success > 99%, policy false-positive review < 1%.
- Degraded-mode exposure for templates/plugins < 1% requests per hour.

## Rollback Triggers

- Editor open/save failures for canary cohort.
- Data integrity risk (content mismatch / broken restore).
- Error rate materially above baseline for 15+ minutes.
- Missing required schema tables in prod (`doc_editor_comment_thread_meta`, `doc_editor_comment_thread_user_state`, `doc_editor_plugins`) after deploy.
- Plugin/template endpoints stuck in degraded mode for > 30 minutes.
- AI streaming cannot be cancelled or returns corrupted partial responses.

## Rollback Steps

1. Disable canary exposure.
2. Roll frontend to last stable build.
3. Re-run smoke checks on stable build.
4. Publish incident note and root-cause owner.
5. Re-enable canary only after fix + validation.

## Exit Criteria

- No blocker incidents during canary window.
- Metrics within baseline.
- Product + engineering sign-off completed.
