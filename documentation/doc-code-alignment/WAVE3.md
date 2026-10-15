# Alignment remediation — Wave 3 (2026-09-30)

Triage and rewrite living cites for **actionable missing paths** (post Wave 1–2).

## Approach

1. **Rewrite** living docs that pointed at removed skills/rules/plans/scripts.  
2. **Mark** planned-not-shipped and operator-runtime markers honestly.  
3. Expand classifier class `intentional_absent_or_untracked` so audit triage stays honest.

## Doc rewrites (high signal)

| Topic | Change |
|-------|--------|
| Product audit skill | Backlog / Socket.IO / cause-first → `fixed-errors/products.json` + backlog (skill soft-retired) |
| Bus-factor rule | Manifesto + EWA kernel redesign: review expectation kept; `.mdc` marked removed |
| Stack9 voice kill-switch | Topology / build commands: marker is **operator-created / untracked** |
| GitHub community install | SoT + plan: `install-community.sh` / `community.yml` **planned W4, not on disk** |
| Cursor plans | Living docs scrubbed off `.cursor/plans/*.plan.md` (IDE-local, not monorepo SoT) |
| Guide audio scripts | Onboarding / guided tour: scripts **absent** |
| Companion tool-router eval | Point to `shared/api/tests/test_companion_tool_router.py` |
| GenEW harvest | Removed hooks/rules labeled; living `eliteew-fix-generator-not-capsule.mdc` |
| Standalone runtime / Jitsi monitor | Marked absent; prefer deploy line / incident canon |
| Desktop llama chat smokes | Honesty banner: `desktop-ai-chat-*.sh` helpers not in tree |
| LocalStorage inventory / ENV-FLAGS | Retargeted to living cache model / companion canon |
| KBSEW pyrightconfig | Optional / may be absent |

## Audit delta (classified)

| Metric | After Wave 2-ish | After Wave 3 |
|--------|-----------------:|-------------:|
| Path mismatch (raw) | ~363 | **338** |
| Actionable candidates | ~175 | **105** |
| Intentional absent/untracked | 0 | **24** |

Remaining actionable (~105) is mostly ops scripts/logs/host paths with single cites — candidates for Wave 4 batch honesty notes or restore-from-trash decisions.

## Next wave (Wave 4)

1. Remaining actionable single-cite scripts (`diagnose-app-404`, lan-workers punisher leftovers, nvidia install, …).  
2. Domain-matrix stale patterns (`EliteEW/scripts/**`, `trash/EliteEWWebViewAndroid/**`).  
3. Public-buyer export broken relative links (6).

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
