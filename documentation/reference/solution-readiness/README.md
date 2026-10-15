# Solution readiness (retired registry)

**Status:** retired as an agent gate (2026-09-17 cleanup)  
**Former role:** pre-implement READY projections + anti-crutch proof before prod writes  
**Former skill/hook:** `eliteew-solution-readiness` / `solution-readiness-gate.py` — soft-retired under `trash/`

## Living guidance

Use **cause-first** intake (`cause-first-intake.mdc`, skill `/cause-first`) and
[AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](../../platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md)
instead of a mandatory READY file gate.

Historical projection markdown may exist in `trash/` or git history. Do not
recreate the failClosed READY write-blocker without an explicit operator task.

## Related

- Fixed-errors (still living): [../fixed-errors/README.md](../fixed-errors/README.md)
- Serial session hygiene: [../../platform/AGENT-SERIAL-SESSION.md](../../platform/AGENT-SERIAL-SESSION.md)
