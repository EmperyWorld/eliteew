# Agent Gemma Senior Auditor (optional)

**Status:** living — **optional skill**, not a mandatory closeout gate  
**Owner rule:** `.cursor/rules/gemma-senior-auditor-gate.mdc` (`alwaysApply: false`)  
**Skills:** `.cursor/skills/validate-via-gemma/SKILL.md`, `.cursor/skills/deploy-gemma-gate/SKILL.md`  
**CLI:** `.cursor/hooks/gemma-gate.py` (+ `gemma_gate_client.py`)  
**Hooks:** **not wired** in `hooks.json` (no stop / shell / afterFileEdit enforcement)

## Why it exists

Historical: external senior auditor before ship after narrative-vs-cause failures.
**2026-09-17:** demoted from mandatory HARD gate to operator-invoked optional skill
(`/validate-via-gemma`). Done / commit / build / flash do **not** require `ОДОБРЕНО`.

## When to run

Only when the operator asks for `/validate-via-gemma` or an explicit Gemma pass.

```bash
python3 .cursor/hooks/gemma-gate.py run --goal '<goal>'
```

## Endpoint

| Item | Value |
|------|--------|
| Host | prod-core `192.168.1.111` (override: `ELITEEW_GEMMA_GATE_BASE` or gemma-gate.local.env *[optional local override under .cursor/hooks/]*) |
| Port | `8080` |
| Service | `stack2-llama-chat` (llama.cpp OpenAI-compat) |
| Health | `GET /health` |
| Models | `GET /v1/models` |
| Chat | `POST /v1/chat/completions` |

## Verdict tokens

| Token | Machine status | Meaning |
|-------|----------------|---------|
| `ОДОБРЕНО` (first non-empty line) | `APPROVED` | Optional auditor liked the diff |
| `ЛОПАТА` / `FAIL` (first non-empty line) | `FAIL` | Structured Cause blocks — apply only if operator wants |

**Anti false-FAIL:** machine parse uses **first line only**.

## Trust (CLI)

- Prefer `gemma-gate.py run` for live `source=live_api` records.
- Manual `record` remains **BLOCKED-only** (unreachable auditor bookkeeping).
- Fingerprint binds session paths + content when a run is recorded.

## Order with other gates

1. Optional Gemma — only if operator asked  
2. Tauri security (if scoped)  
3. Commit — **only on operator request** (`verified-proposal-protocol.mdc`)

## Residual

| Residual | Note |
|----------|------|
| Auditor down | Optional skill fails honestly; does **not** block Done |
| Same host as language-bridge | LB still uses `:8080`; independent of this skill |
| Unwired hooks | Re-wiring `gemma-gate.py` into `hooks.json` would restore mandatory behavior — do not without operator ask |

## Related

- Language bridge (unhooked 2026-09-22; optional helper only): `AGENT-LANGUAGE-BRIDGE.md`
