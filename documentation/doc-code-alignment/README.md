# documentation/doc-code-alignment/

**Purpose:** Machine-indexable audit of living documentation claims vs monorepo code/tree.  
**Not living product canon.** Do not treat as SoT for product behavior.

## Progress

| Wave | Focus | Status |
|------|-------|--------|
| [WAVE1.md](WAVE1.md) | Hubs, broken links, script paths, unhooked gates | Done |
| [WAVE2.md](WAVE2.md) | Living Current **0.5.30** → SoT **0.5.37** / public **0.5.36** | Done |
| [WAVE3.md](WAVE3.md) | Actionable missing paths + intentional class | Done |
| [WAVE4.md](WAVE4.md) | Domain matrix + buyer export links + residual triage | Done |
| [WAVE5.md](WAVE5.md) | Relocated cites + honesty + classifier/extractor | Done |
| [WAVE6.md](WAVE6.md) | EliteEW mid-alias + pending→applied + worklog stub | Done |
| [WAVE7.md](WAVE7.md) | Brace/ellipsis expand + absent-helper path hygiene | Done |
| [WAVE8.md](WAVE8.md) | Set-notation expand + LAN absent + EliteEW/.cursor prose | Done |
| [WAVE9.md](WAVE9.md) | Extractor harden + ban/unhooked path soften | Done |
| [WAVE10.md](WAVE10.md) | Ellipsis expand + trash/absent-script soften | Done |
| [WAVE11.md](WAVE11.md) | Secrets/runtime/local residual soften → mismatch 0 | Done |

## Snapshot (latest audit)

| Metric | Value |
|--------|------:|
| Path mismatch | 0 |
| Actionable (incl. relocated wrong cite) | 0 |
| Broken internal links | 0 |
| Intentional absent/untracked | 0 |

## Layout

| Path | Role |
|------|------|
| `manifest.json` | Run metadata + section rollup |
| `SUMMARY.md` | Human rollup |
| `SPOTCHECKS.md` | Manual high-value canon vs code |
| `MATCHES.md` / `MISMATCHES.md` | Compact lists |
| `MISMATCHES-CLASSIFIED.md` / `ACTIONABLE.md` | Classifier buckets |
| `WAVE1.md`…`WAVE11.md` | Remediation wave logs |
| `raw/*.jsonl` | Streamable findings (`kind`, `status`, …) |
| `by-section/` | Per-section slices |
| `scripts/` | Regenerators |

## Regenerate

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```

## Agent ingest order

`manifest.json` → `raw/missing-paths-classified.jsonl` → `ACTIONABLE.md` → `SPOTCHECKS.md` → section JSONL as needed.
