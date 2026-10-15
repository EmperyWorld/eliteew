# Agent Trash And Deletion Policy

Owner for **host monorepo tree** agent behavior. Complements `.cursor/rules/trash-and-deletion-policy.mdc` and hook `.cursor/hooks/trash-retention-gate.py`.

## Purpose

Agents must not delete project files. Removal means **move to `trash/`** at repository root via the blessed script. If deletion already happened or is suspected, the agent **stops** and does not attempt recovery.

## Normal workflow — remove a path

```bash
bash scripts/eliteew/trash-move.sh <path> [<path>...]
```

| Item | Detail |
|------|--------|
| Script | `scripts/eliteew/trash-move.sh` |
| Destination | `trash/<UTC-timestamp>/<original-relative-path>` |
| Git | `trash/` is gitignored (see root `.gitignore`) |
| Edits | Use **StrReplace** / EditNotebook on existing files; **not** Write overwrite |
| Enforcement | Cursor hook `trash-retention-gate.py` (preToolUse, failClosed) |

### Blocked agent actions (non-exhaustive)

- `rm`, `rmdir`, `unlink`, `shred`, `truncate`
- Cursor **Delete** tool
- **Write** when target file already exists
- `git rm`, `git clean`
- `find … -delete`, `rsync … --delete`
- `mv -f` / `cp -f` / `cp --remove-destination` over existing paths
- Shell redirect overwrite: `> existing-file` (not `2>/dev/null`)

### Allowed

- `bash scripts/eliteew/trash-move.sh …`
- `mv … trash/…` (into trash only)
- `mkdir -p trash`

Container/runtime paths (`podman exec`, `/app/…` inside images) are separate; this policy applies to **repository files on the host**.

Soft-retired operator apps (`DEWA`, `EWGen`, …) already live under `trash/`. Do not recreate them at workspace root. There is **no** nested-repo dual-commit path for those trees.

## Accidental deletion incident protocol

Trigger when **any** of:

- Agent ran a destructive command or tool outside `trash-move`
- Operator reports missing files after agent activity
- Hook blocked delete but partial damage may have occurred
- Agent discovers it used `git restore` / `rm` / Delete before hook fired

### Agent MUST

1. **Stop** the current task immediately.
2. Enter **read-only incident mode**: no Shell, Write, StrReplace, Delete, deploy, or recovery automation — **only** notify the operator in chat.
3. **Do not touch git** (no status/diff/restore/reset/commit/push) until the operator explicitly states the incident is **resolved** in the current message.
4. Report: command/tool, paths, session context, and that the agent is halted.

### Agent MUST NOT

- «Fix» by restoring from git, copying from backup, re-cloning, rebaking, or moving things without operator direction
- Continue unrelated implementation work
- Hide or minimize the incident

### Operator clearance

Resume normal agent work only after explicit operator message that the deletion incident is **closed** (e.g. «проблема решена», «можно продолжать»). Until then, the agent answers only about the incident or waits.

## Related

| Resource | Role |
|----------|------|
| `.cursor/rules/trash-and-deletion-policy.mdc` | Always-on agent rule |
| `.cursor/rules/git-agent-restrictions.mdc` | §Deletion incident freeze |
| `.cursor/rules/verified-proposal-protocol.mdc` | No commit during delete incident; Commit Package otherwise |
| `.cursor/rules/dev-tooling.mdc` | Hooks table |
| `.cursor/hooks/trash-retention-gate.py` | Automated preToolUse gate |
| `documentation/platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md` | Commit after approval |
| `documentation/worklog/README.md` | Worklog retired stub |

## Changelog

| Date | Change |
|------|--------|
| 2026-07-18 | Align with VPP, retired worklog, soft-retired DEWA/EWGen under trash/ |
| 2026-06-24 | Initial canon: trash-move, hook, accidental-delete hard stop |
