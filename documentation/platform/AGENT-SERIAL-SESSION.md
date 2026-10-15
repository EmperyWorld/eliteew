# Agent Serial Session Hygiene

**Status:** living  
**Owner rule:** `.cursor/rules/eliteew-serial-session.mdc` (`alwaysApply: true`, thin)  
**Skill / command:** `/eliteew-serial-session` → `.cursor/skills/eliteew-serial-session/SKILL.md`  
**Subagent:** `.cursor/agents/session-hygiene.md` (`readonly: true`)  
**Hook:** `.cursor/hooks/serial-session-gate.py` → `[SERIAL SESSION]` on `sessionStart` + `preCompact`

## Operator lock

One checkout. One chat. One agent.

**Out of scope as productivity advice:** parallel agents, git worktrees, multi-root workspaces.

## Contract

| Axis | Behavior |
|------|----------|
| Thread | Continue the same chat (`--continue` / resume). Do not open a fresh empty chat for the same task. |
| Prefix | Keep model / Max / MCP / rules stable mid-wave unless the operator asks. |
| Context | Prefer Plan/Ask before Agent edits; `/summarize` near ~70% full; no `@`-dump of whole trees (path + `rg`). |
| MCP | Leave Playwright MCP off unless the task is browser/E2E. |
| Index | Respect `.cursorignore` / `.cursorindexingignore`; after ignore edits → Reload Window. |

## Prompt / KV cache (provider)

Cursor does not keep-alive the provider cache. Anthropic-class idle TTL is often ~5 minutes — the first turn after a break is cold; then stay in the **same** thread. A stable system prefix (rules / MCP / model) improves hit rate across turns.

## Hook behavior

| Event | Output |
|-------|--------|
| `sessionStart` | Inject `[SERIAL SESSION]` brief (fail-open) |
| `preCompact` | Inject summary-hygiene reminder (fail-open) |

The hook does **not** deny tools. Deeper checklist: skill `/eliteew-serial-session`. Readonly audit: subagent `session-hygiene`.

## Related

- Language bridge: [AGENT-LANGUAGE-BRIDGE.md](AGENT-LANGUAGE-BRIDGE.md) (**unhooked** 2026-09-22; RU UI payload → localization-engine)
- Optional Gemma auditor: [AGENT-GEMMA-SENIOR-AUDITOR-GATE.md](AGENT-GEMMA-SENIOR-AUDITOR-GATE.md)
- Commit on demand: [AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](AGENT-VERIFIED-PROPOSAL-PROTOCOL.md)
- Cursor steward: `.cursor/skills/eliteew-cursor-steward/`
