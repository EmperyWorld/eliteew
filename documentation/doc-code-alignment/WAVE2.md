# Alignment remediation — Wave 2 (2026-09-30)

Sweep living **Current / public OTA** claims that still said **0.5.30** after Wave 1 hubs were fixed.

**SoT:** [`product/desktop/DESKTOP-CLIENT-VERSION-SOT.md`](../product/desktop/DESKTOP-CLIENT-VERSION-SOT.md) + `pack-organization/connection-agent/docs/release-state.v1.json`  
→ TREE **0.5.37**; public Linux RPM Connected/FoFline **0.5.36** (`lag`); Windows NSIS **0.4.61**.

## Done

| File | Change |
|------|--------|
| `platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md` | Status public OTA → **0.5.36** / TREE **0.5.37** |
| `platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md` | R11 + hygiene living Current; HEAD row labeled snapshot 2026-09-10 |
| `platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md` | Index rows + open `#016` E2E target → **0.5.36**; dated snapshots → **Then-Current** + SoT pointer |
| `product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md` | Desktop OTA row → CHANNEL_MATRIX `lag` **0.5.36** |
| `product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md` | Living public / digests-only Current → **0.5.36** |
| `product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md` | Fleet / ops / OTA table / Fedora E2E / dnf5 public target → **0.5.36** |
| `product/desktop/DESKTOP-FOFLINE-EDITION.md` | Fleet / W4 / A4 living Current → **0.5.36** (aligned with §13.3) |
| `product/desktop/DESKTOP-EBROWSER.md` | Wave O kept as 2026-09-10 history + living SoT pointer |
| `project_master_card.md` | 2026-09-10 live note → **Historical** + SoT pointer |

## Left as history (intentional)

- Changelog / evidence rows that record the **0.5.30** ship (seq 90/92), Wave O, done tickets.
- Version ladder text that *mentions* 0.5.30 as a milestone inside a longer 0.4.x→0.5.36 chain.

## Next wave (Wave 3)

Classify / fix remaining **actionable path absences** (~175): real missing scripts/flags (`install-community.sh`, stack9 voice, companion eval, …) vs intentional/noise — rewrite living cites or mark retired.

## Regen after wave 3+

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
