# Agent Verified Proposal Protocol

Operator-facing canon for **when the agent may run `git commit`**. Rule owner:
**`.cursor/rules/verified-proposal-protocol.mdc`**.

## Resolution (commit on demand)

| Source | Policy |
|--------|--------|
| Operator | Commit **only** when explicitly requested in the current message |
| Repository hooks | Deny push / `git add -A` / WIP discard; allow selective `git commit` **when asked** |

The agent **must not**:

1. Run `git commit` at task close / «готово» without an explicit ask.
2. Require a Commit Package, local commit, or «Commit: skipped» line to close work.
3. Treat stop hooks, hard acceptance, or Gemma as permission to commit.

Uncommitted work after a finished task is the **normal default**.

## When the operator asks to commit

Phrases: **`commit now`** / **`закоммить`** / **`сделай commit`** (or clear equivalent)
in the **current** message.

1. `git status` / `git diff` / `git log -5 --oneline`
2. Own changes only — selective `git add` (never `git add -A` / `commit -a`)
3. `git commit` with a why-focused message
4. Reply with `git log -1 --oneline`

Optional short staging summary for large sets — helpful, not a gate.

**Push** remains separate: explicit operator request only; shell hook blocks `git push`.

## Exceptions

| Case | Behavior |
|------|----------|
| No commit request | Do nothing git-mutating related to commit |
| Trash/delete incident | Git forbidden until operator closes incident |
| Operator forbids commit | Do not commit |

## Hook and gate alignment

| Component | Behavior |
|-----------|----------|
| `validate-agent-policy.py` / `shell_policy.py` | Allow selective `git commit`; hint on-demand; deny push / add -A / WIP discard |
| `git-phase-gate.py` | May record commits for session state; **no** stop nag for missing commits |
| `completion-gate.py` | DOC-only phase reminders; must not inject Commit Package / commit-required closeout text |
| Retired `hard-acceptance-gate.py` | Soft-retired — not a commit or Done gate |

## Soft-retired trees

No nested-repo dual-commit (`EWGen/` etc. under `trash/`).

## Related

- `.cursor/rules/git-agent-restrictions.mdc`
- `.cursor/rules/verified-proposal-protocol.mdc`
- `.cursor/hooks/git-phase-gate.py`
