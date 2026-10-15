# Agent Language Bridge (Gemma) — retired from agent loop

**Status:** **unhooked / retired as mandatory agent gate** (2026-09-22 — `chore(cursor): drop language-bridge and Tauri security from the agent loop`).  
**Living substitute for RU UI payload work:** Dual-Mode Localization — rule `eliteew-localization-engine.mdc`, skill `eliteew-localization-engine`.  
**Optional auditor (not this bridge):** [AGENT-GEMMA-SENIOR-AUDITOR-GATE.md](AGENT-GEMMA-SENIOR-AUDITOR-GATE.md) / `/validate-via-gemma`.

## What remains on disk

| Path | Role now |
|------|----------|
| `.cursor/skills/eliteew-language-bridge/scripts/gemma_language_bridge.py` | Optional helper CLI (`intake` / `outtake` / `ui-ru`) — **not** a failClosed skill entrypoint |
| `.cursor/hooks/language-bridge-gate.py` | May still exist; **not** part of the living agent loop after the 2026-09-22 drop |
| eliteew-language-bridge rule *[intentionally unhooked]* | **Removed** — do not recreate without an explicit operator task |
| eliteew-language-bridge skill *[intentionally unhooked]* | **Removed** — do not recreate without an explicit operator task |

## Former contract (historical)

| Direction | Mode | Output |
|-----------|------|--------|
| Operator → agent | `intake` | Structured English brief (not literal translate) |
| Agent → operator | `outtake` | Natural spoken Russian — verbatim only in chat |
| EN UI → RU UI | `ui-ru` | Mode 1 STRICT UI ENGINE (now owned by localization-engine) |

Former absolute laws (mutating tools locked until intake, outtake-only final chat, deny agent-authored operator RU) applied only while the gate was hooked. They are **not** living DoD after the drop.

## Endpoint (helper CLI only)

`ELITEEW_GEMMA_GATE_BASE` (default `http://192.168.1.111:8080`). Model from `GET /v1/models`.

Does **not** write senior-auditor `ОДОБРЕНО`.

## Bypass / disable (ops only)

Host env such as `ELITEEW_LANGUAGE_BRIDGE_HOOK=0` was ops-only when the gate was live. Do not treat this document as permission to re-enable failClosed language-bridge theater.

## Related

- Localization (living): `.cursor/rules/eliteew-localization-engine.mdc`
- Serial session: [AGENT-SERIAL-SESSION.md](AGENT-SERIAL-SESSION.md)
- Verified proposal / commit on demand: [AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](AGENT-VERIFIED-PROPOSAL-PROTOCOL.md)
