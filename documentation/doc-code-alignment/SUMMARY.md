# Doc ↔ code alignment audit

**Generated:** 2026-09-30T22:09:06Z  
**Schema:** `eliteew.doc_code_alignment.v1`  
**Scope:** all `documentation/**/*.md` except this directory; monorepo root `/data/repos/powered_by_emperyworld`.

## Verdict snapshot

| Metric | Count |
|--------|------:|
| Docs inventoried | 983 |
| Path-ref checks | 2873 |
| Path matches | 2873 |
| Path mismatches | 0 |
| Unique missing paths | 0 |
| Broken internal `.md` links | 0 |
| Structural mismatches | 0 |
| Structural soft matches | 0 |

## How to index (agent)

1. Read [`manifest.json`](manifest.json) for run metadata + section rollup.
2. Stream [`raw/missing-paths-unique.jsonl`](raw/missing-paths-unique.jsonl) (one claim per line).
3. Stream [`raw/docs-with-missing-refs.jsonl`](raw/docs-with-missing-refs.jsonl) for doc→gap fan-in.
4. Narrow by section via [`by-section/<section>-path-findings.jsonl`](by-section/).
5. Spot-check domain claims in [`SPOTCHECKS.md`](SPOTCHECKS.md) (manual high-value canons).

Each JSONL row has `kind` + `status` (`match` | `mismatch` | `soft_match`).

## Section rollup

| Section | Docs scanned | Path refs | Match | Mismatch | Export skipped |
|---------|-------------:|----------:|------:|---------:|---------------:|
| api | 15 | 111 | 111 | 0 | 0 |
| database | 4 | 9 | 9 | 0 | 0 |
| platform | 129 | 1069 | 1069 | 0 | 0 |
| product | 476 | 1465 | 1465 | 0 | 241 |
| reference | 114 | 163 | 163 | 0 | 0 |
| root | 3 | 50 | 50 | 0 | 0 |
| worklog | 1 | 6 | 6 | 0 | 0 |

## Structural / alias checks

- `match` — shared/api
- `match` — shared/web/frontend
- `match` — shared/apps
- `match` — shared/packages
- `match` — shared/tools
- `match` — pack-cloud/mobile
- `match` — pack-organization/connection-agent
- `match` — pack-organization/trusted-substrate
- `match` — docker/scripts/eliteew-deploy.sh
- `match` — docker/stack/stack0_b.yml
- `match` — docker/stack/stack0_f.yml
- `match` — docker/stack/stack1.yml
- `match` — docker/stack/stack2.yml
- `match` — docker/stack/stack4.yml
- `match` — docker/stack/stack6.yml
- `match` — docker/stack/stack11.yml
- `match` — docker/stack/stack12.yml
- `match` — scripts/eliteew/trash-move.sh
- `match` — .cursor/domain_matrix.json
- `match` — .cursorrules
- `match` — documentation/INDEX.md
- `match` — documentation/platform/PRODUCTION-TOPOLOGY-STATE.md
- `match` — documentation/platform/ELITEEW-PACK-LAYOUT.md
- `match` — eeprodline implementer alias (found: docker/scripts/eeprodline.sh)
- `match` — eectl ops CLI (found: docker/scripts/eliteew-container-control.py, docker/scripts/eliteew-docker-aliases.sh)

## Top unique missing paths (by cite count)

| Cites | Path |
|------:|------|

## Docs with most missing refs

| Missing | Doc |
|--------:|-----|


## Broken internal links (sample)

First 40 of 0 — full list in `raw/broken-internal-links.jsonl`.



## Caveats

- Heuristic extraction: false positives possible (illustrative paths, future targets, trash examples).
- A `mismatch` is **candidate drift**, not automatic proof the doc is wrong (may be intentional plan/target).
- Semantic contract checks (API shapes, env keys, ports) live in `SPOTCHECKS.md`, not this path pass.
