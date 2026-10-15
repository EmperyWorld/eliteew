# Agent Cause-First Intake and Premium User Interface

Operator-facing summary of Cursor rules that require **root-cause fixes**,
**self-healing user journeys**, and **premium user-facing UI** instead of
operator-console defaults.

## Cause-first (always on)

**Owner:** `.cursor/rules/cause-first-intake.mdc`

Agents must classify work as **Cause**, **Lock** (regression guard after cause), or **Measure** (audit/scorecard). Closing a phase on i18n/tests/docs alone is forbidden for medium+ tasks.

Operator prompt snippet:

```text
Optimize for root cause, not audit score or test green.
Symptom-only work allowed only as regression lock after the cause fix.
If the fix is copy/test/doc only, stop and report the missing cause layer first.
```

Required closeout block: Root cause → Cause-layer changes → Symptom-only (if any) → Evidence → **Commit Package** (or `Commit: skipped — …`).

**Git gate (VPP):** on session stop, `[GIT COMPLETION GATE]` if code/docs/rules were touched — prepare **Commit Package** per `AGENT-VERIFIED-PROPOSAL-PROTOCOL.md`. Do **not** treat the gate as permission to `git commit` without operator approval (`verified-proposal-protocol.mdc`).

Product audit scoring caps (no fake arch/UX lift): this document + [PRODUCT-AUDIT-STABILITY-BACKLOG.md](PRODUCT-AUDIT-STABILITY-BACKLOG.md) (former skill `reference.md` soft-retired with agent-theater slim).

Living follow-up backlog (P0/P1/P2 by product-id): [PRODUCT-AUDIT-STABILITY-BACKLOG.md](PRODUCT-AUDIT-STABILITY-BACKLOG.md).

## User product requirements and obligations (always on)

**Owner:** `.cursor/rules/eliteew-user-product-obligations.mdc`

EliteEW is a user product. Product code must assume that a user does not know
the terminal, environment variables, package formats, internal routes, or
service topology.

Hard obligations:

- Fix the failure layer and complete journey; do not close on a workaround.
- Detection, recovery, retry, rollback, upgrade, and permission prompts belong
  inside the application.
- Never make shell commands, config edits, browser package downloads, or an ops
  runbook the normal or emergency customer path.
- Use professional task language; no raw codes, stack traces, misleading
  jargon, fake success, hidden fallback, or silent downgrade.
- A required privileged operation uses a native OS prompt with human-language
  context and an actionable retry.
- Verify both the primary journey and failure/recovery path. If self-recovery
  is absent, the product task remains incomplete.

Temporary containment is allowed only to preserve safety or availability. It
must be explicit, owned, and followed by a cause-layer change; it is not Done.

Reference journey: application detects the failure → validates a signed
release → requests native permission if needed → repairs/updates → restarts →
confirms the observable result.

Executable enforcement:

- `.cursor/hooks/user-product-obligations-gate.py` runs before customer-facing
  file edits and denies added copy that sends users to a shell, browser package
  download, environment/config edit, or raw internal error code.
- The same hook tracks customer-facing paths after edits. On stop,
  `completion-gate.py` requires an explicit cause-layer and in-product recovery
  account, offline/permission/conflict behavior, observable outcomes, and
  narrow regression evidence.
- Admin/operator surfaces and tests are excluded from the customer-copy deny.
  This does not waive product tests or allow operator language to leak into
  customer paths.
- Deterministic text checks are a guard, not semantic proof. Behavioral tests
  at the recovery boundary remain mandatory.

## Premium user interface (product frontend globs)

**Owner:** `.cursor/rules/premium-user-interface.mdc`
**Workflow:** `.cursor/skills/eliteew-premium-interface/SKILL.md`

Applies when editing:

- `shared/web/frontend/src/features/**`
- `shared/web/frontend/src/pages/Desktop/**`
- Mobile embedded pages

**Out of scope by default:** `pages/Admin/**` (operator dialect). Soft-retired DEWA/EWGen UIs under `trash/` are not living premium-UI targets unless the operator restores them.

Target pattern:

- Hero / context + one primary CTA
- Progressive disclosure for advanced tools
- Desktop design tokens (`DesktopAppChrome`, `--desktop-*`)
- Full state inventory (empty, error, long-running, trust notes)
- Peer components: Professional Worlds visible redesign, `DESKTOP_DESIGN_SYSTEM.md`

Invoke explicitly: «сделай premium user interface», **`/premium-interface`**, or attach skill `eliteew-premium-interface`.

Cause-first intake: **`/cause-first`** or rule `cause-first-intake.mdc`.

## Related skills

| Skill | Use |
|-------|-----|
| `/cause-first` | Command + skill — root cause contract |
| `/premium-interface` | Command — premium UI implementation |
| `/eliteew-session-start` | Preflight + intake briefing |
| `/deep-dive` | Soft-blocked module structure |
| `/eliteew-doc-sync` | Doc gate after code |
| `/eliteew-serial-session` | Serial Cursor hygiene (one chat / cache / lean MCP) |
| `/eliteew-fixed-errors` | Consult/record product defect registry |
| `/eliteew-testing` | Selective tests |
| `/keycloak-eliteew` | Auth/OIDC |
| `eliteew-premium-interface` | Implement user-facing UI to premium bar |

## Mirror

Cursor SoT is monorepo-root `.cursor/` + `.cursorrules` only. The EliteEW mid-alias `.cursor` mirror is retired (Wave Mirror-retire, 2026-08-16).

## Related agent canons

- `AGENT-VERIFIED-PROPOSAL-PROTOCOL.md` — commit only on explicit operator request
- `AGENT-SERIAL-SESSION.md` — one chat / cache / lean MCP
- `AGENT-DOMAIN-BOUNDARY-GATE.md` — cross-domain HARD STOP
- `AGENT-TRASH-AND-DELETION-POLICY.md` — trash-move only; no delete
- [../reference/solution-readiness/README.md](../reference/solution-readiness/README.md) — retired stub (was READY gate)
- [../reference/fixed-errors/README.md](../reference/fixed-errors/README.md) — known defects by product
