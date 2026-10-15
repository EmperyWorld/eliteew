# Alignment remediation — Wave 1 (2026-09-30)

Brought high-signal living docs into correspondence with the monorepo tree/code.
Audit artifacts under this directory were regenerated after the edits.

## Done

| Area | Change |
|------|--------|
| Desktop TREE hubs | `HANDBOOK-MAP`, `product/desktop/README`, passport inventory row → TREE **0.5.37** / Linux RPM **lag 0.5.36** / Windows **0.4.61** per `release-state.v1.json` |
| Hard-acceptance links | Removed dead `AGENT-HARD-ACCEPTANCE-WORKFLOW.md` cites → `TESTING-STRATEGY` + `AGENT-CODE-VERIFICATION-WORKFLOW` |
| Solution-readiness | Living links retargeted to stub `reference/solution-readiness/README.md`; 19 fixed-errors readiness fields updated |
| Script path cites | Absolute-from-root paths for lint/export/allowlist/bundle-budget/start_all/selftest/air-enroll/build-iso (where wrong) |
| Language bridge / Tauri skill | Docs + `.cursorrules` ownership rows mark **unhooked 2026-09-22** (intentional drop; do not restore without operator task) |
| God-file LOC | Baselines refreshed to on-disk LOC (2026-09-30) |
| Auth path wording | `shared/web/auth/` clarified as removed → `trash/` |
| Auditor bugfix | Path extractor no longer substring-matches `scripts/*.sh` inside longer repo paths |

## Deliberately not rewritten this wave

- Dated audit snapshots that still say “Current 0.5.30” inside `PRODUCT-AUDIT-STABILITY-BACKLOG` / FoFline historical tables (snapshot dates stand; hubs point at SoT).
- Public-buyer export mirror relative `export/md/README.md` broken links (export noise).
- Relative `scripts/…` inside pack trees after an explicit `cd pack-organization/…` (correct relative form).
- Container mount strings `/app/docker/scripts/start_all.sh` (runtime path, not host SoT).

## Next wave candidates

1. Sweep remaining “Current **0.5.30**” living claims that are not dated snapshots.
2. Classify / fix remaining actionable path candidates (~200) that are real absences (`install-community.sh`, stack9 voice flag, etc.).
3. Domain-matrix stale patterns (`EliteEW/scripts/**`, `trash/EliteEWWebViewAndroid/**`).
4. Optional: public-buyer export link hygiene.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
