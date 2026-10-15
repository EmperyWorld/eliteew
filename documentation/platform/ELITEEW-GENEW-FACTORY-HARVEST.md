# EliteEW ← genEW Factory Harvest (program canon)

**Status:** Living — Wave F0–F7 Done (2026-08-05); Wave G1–G3 Topology + deeper factory Done (2026-08-05).
**Parent:** [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) §4 (Gen/Forge), §10 (harvest).
**Agent skill:** `/eliteew-capability-harvest` · source map `.cursor/skills/eliteew-capability-harvest/references/source-map.md`.

## 1. Goal

Port **factory mechanisms** from external prototype `/data/repos/genEW` (and soft-retired soft-retired EWGen under `trash/`) into EliteEW **Kernel + pluggable Desktop apps** so that:

- new capabilities attach by **recipe/pack → manifest → verify**, not by forking a second product tree;
- agent claims of “done” are subordinate to **machine gates**;
- long factory jobs can run as **intentions** with checkpoints (outside a single Cursor session).

This is **capability harvest**, not a second Empery/ECC/EIC control plane on prod-core.

## 2. Locked decisions

| Decision | Choice |
|----------|--------|
| Sources | `/data/repos/genEW` + soft-retired EWGen under `trash/` — read/extract only; **never** restore whole trees to monorepo root |
| Product shape | **Gen/Forge** = Kernel factory capability (+ later Admin UI); not a Desktop Start app in early waves |
| Factory UI | Cursor skills/hooks first → then Unified Admin **Factory** section (adjacent to Platform Ops). No Desktop Gen/Forge app in Waves 0–5 |
| Intention host | New package `shared/api/ewa_platform/factory/` (Wave 5), reusing agentic checkpoint patterns — **not** companion chat turn, **not** port of EIC Podman service |
| Assembly | Port **law** of Gates T∧C + freeze deny; full Babel `assemble.mjs` only in deferrable Wave 7 |
| Done matrix | Adapt genEW D1–D3 to EliteEW manifests + mount registry (not ECC U1–U9 1:1) |

## 3. Mechanism map (A–H)

| ID | Mechanism | EliteEW NOW (Wave 0) | Target |
|----|-----------|----------------------|--------|
| A | Recipe/profile catalog | `.cursor/orchestration/recipes/` + P18 golden | Pack↔manifest + Intention (Wave 5+) |
| B | Done = API + Admin + Desktop mount | Manual scaffold + switch mount | DoD + D1–D3-style gates (Waves 1–2) |
| C | Authoritative verify T∧C | Gate T∧C evaluate (flag-gated) | Done (Wave 7) — `ELITEEW_FACTORY_ASSEMBLY` |
| D | Fix generator not capsule | Absent | Rule + hook (Wave 3) |
| E | Intention FSM | Factory package + Admin API/UI + Celery `ewa_factory` | Stable (atoms feed plan/verify) |
| F | Memory atoms | Factory decision/verify atoms + context_pack | Done (Wave 6) — parallel store, not ewa_atom PG |
| G | Extract-adapt | Dry-run `extract-adapt-map.py` + harvest JSON | Done (Wave 6) — `--apply` after Approval |
| H | Role prompts IDE↔runtime | Cursor-only | Role digests into factory Think prompts (Wave 5) |

## 4. Program waves

| Wave | Focus | Status |
|------|-------|--------|
| **0** | Canon + harvest source-map + INDEX/HANDBOOK | **Done** (this doc) |
| **1** | Declarative mount registry + FE/API KNOWN sync | **Done** (2026-08-05) — `shell/appMounts.*` + `knownDesktopAppComponents.generated.json` |
| **2** | `verify-app-factory` DoD gates | **Done** (2026-08-05) — `scripts/eliteew/verify-app-factory.sh` D1∧D2∧D3 |
| **3** | Fix-generator rule + protect-scaffold hook | **Done** (2026-08-05) — rule + `protect-scaffold-outputs.py` + template freeze |
| **4** | Recipe packs + golden registry | **Done** (2026-08-05) — `.cursor/orchestration/recipes/` + P18 + `/eliteew-factory-plan` |
| **5** | Factory Intention FSM + admin API + Admin Factory UI (flagged) | **Done** (2026-08-05) — `ewa_platform/factory/` + `/desktop/admin/factory` + Admin section |
| **6** | Factory memory atoms + extract-adapt dry-run | **Done** (2026-08-05) — `factory/atoms` + `extract-adapt-map.py` |
| **7** | Config-driven assembly pilot (Gates T∧C full) | **Done** (2026-08-05) — `ELITEEW_FACTORY_ASSEMBLY` default OFF + Gate T∧C |
| **G1** | Admin Topology Map (honest cards + declared edges) | **Done** (2026-08-05) — Admin `topology` + `/api/v1/desktop/admin/topology` |
| **G2** | Factory intention overlay on topology nodes | **Done** (2026-08-05) — `pack_node_map` + badges/highlight |

Detailed steps and proof commands: plan file `genew_factory_harvest_ec52b368.plan.md`; G-waves: `genew_total_recon_*.plan.md`.

## 5. Explicit drops

Do **not** bring into EliteEW as living product:

- ECC + EIC + deploy-agent as a second control plane on `.111`
- FakeAI / demo runner / InMemory bus on production path
- Builds on prod-core; factory mutations that bypass `eliteew-deploy` for stack0 release
- Whole DEWA / EWGen / genEW trees at monorepo root
- Full Babel assembler + golden `assembly_lib` before Wave 7 Approval
- Replacing Cursor IDE workflow with Autonomous-only

## 6. genEW reference (read-only pointers)

| Topic | Path under `/data/repos/genEW` |
|-------|--------------------------------|
| North star | former rule `empery-north-star.mdc` (**removed**) |
| Recipes / P18 golden | `.cursor/orchestration/recipes/` |
| Config-driven assembly law | former orchestration note `CONFIGURATION_DRIVEN_ASSEMBLY.md` (**removed**; living harvest = this file) |
| Headless loop | `services/empery_intelligence_core/src/core/reflexes/agent_loop.py` |
| Intention lifecycle | `…/reflexes/lifecycle.py`, `intention_worker.py` |
| Gates T∧C | `…/integration/assembly_gates.py` |
| Desktop D1–D3 | `…/integration/service_scaffold_desktop.py` |
| Fix generator | use living rule `.cursor/rules/eliteew-fix-generator-not-capsule.mdc` (replaces removed `fix-generator-not-capsule.mdc`), former hook `protect-generator-capsules.py` (**removed** with agent-theater slim) |

## 7. Failure / Edge-Case Matrix (program)

| Axis | Behavior |
|------|----------|
| **Offline** | Factory intention pauses on LLM/API unavailable; Admin shows paused + reason (Wave 5+) |
| **Dual-flag** | `ELITEEW_FACTORY_AUTONOMOUS=0` (default): plan/verify only, no auto implement writes; install-profile still gates Desktop launch |
| **Permission** | Factory API: admin role only; Desktop users do not see Factory section; default deny cross-app data |
| **Regression** | Wave 0: link sanity. Wave 2+: `verify-app-factory` on gold apps. Wave 5: FSM pytest + Admin smoke |

## 8. Honest delta (Wave F5)

| Claim | Truth |
|-------|--------|
| App scaffold skill | **Done** — `/eliteew-app-scaffold` + factory verify in closeout |
| Mount SoT | **Done** — `APP_MOUNTED` + `resolveAppMount` |
| FE/API KNOWN sync | **Done** — generated JSON ∪ shell-only |
| Factory DoD gates D1–D3 | **Done** — `verify-app-factory.sh` |
| Fix-generator + protect scaffold | **Done** — rule + hook + Gate T lite |
| Recipe / P18 golden catalog | **Done** — recipes + `pack_golden_law` + `/eliteew-factory-plan` |
| Factory Intention runtime | **Done** — FSM + Admin API/UI + optional Celery `ewa_factory` (`ELITEEW_FACTORY_ASYNC_JOBS`) |
| Factory memory atoms | **Done** — `factory_decision` / `factory_verify` + `checkpoint.context_pack` |
| Extract-adapt dry-run | **Done** — `scripts/eliteew/extract-adapt-map.py` + harvest skill JSON handoff |
| Config-driven assembly (Gate T∧C) | **Done** — `ELITEEW_FACTORY_ASSEMBLY` (default **OFF**); Admin shows state; evaluate + verify when ON |
| Platform Ops Admin | Living ops — separate from Factory |
| External genEW | Harvest source on host; not in monorepo git |

## 8.1 Factory DoD (D1–D3 adapted)

| Gate | EliteEW evidence |
|------|------------------|
| **D1** | UI source under Desktop `apps/` or `components/` without scaffold stub / FakeAI phrases; or resolve/mount adapter when no dedicated file |
| **D2** | `APP_MOUNTED_COMPONENTS` + `case` in `appMounts.resolve.tsx` + U1 `appRegistry.catalog.ts` |
| **D3** | `shared/apps/<id>/app.manifest.yaml` + `app_component` ∈ API KNOWN |

```bash
bash scripts/eliteew/verify-app-factory.sh project_about notifications
bash scripts/eliteew/verify-app-factory.sh --all-manifests
bash scripts/eliteew/verify-scaffold-templates.sh   # Gate T lite
```

## 8.2 Fix-generator discipline (Wave F3)

| Asset | Role |
|-------|------|
| Rule `eliteew-fix-generator-not-capsule.mdc` | alwaysApply — cure templates/factory_verify, not paper stubs |
| Hook `protect-scaffold-outputs.py` | Deny generated KNOWN hand-edits + stub app edits unless former scaffold gate `ALLOW_SCAFFOLD_EDIT` (**removed**) |
| `TEMPLATE_FREEZE.json` | SHA256 freeze of `eliteew-app-scaffold/assets/*.tmpl` |

## 8.3 Recipe packs + P18 golden (Wave F4)

| Asset | Role |
|-------|------|
| `.cursor/orchestration/recipes/INDEX.md` | Law + product pack catalog |
| `atom_catalog.yaml` | Pack → EliteEW relative globs (trash harvest pointers optional) |
| `pack_golden_registry.yaml` | Product pack ↔ report filenames |
| `.cursor/orchestration/reports/*` | PASSED evidence (assembly-active gate) |
| `pack_golden_law.is_pack_assembly_active` | Machine enforcement |
| Skill `/eliteew-factory-plan` | Intent → pack before scaffold |

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_pack_golden_law.py -q
```

Draft packs (`image_studio`, `site_studio`) stay inactive until a PASSED report is registered.

## 8.4 Factory Intention control plane (Wave F5)

| Asset | Role |
|-------|------|
| `shared/api/ewa_platform/factory/` | FSM + service + store (parallel to agentic) |
| `/api/v1/desktop/admin/factory/*` | Admin enqueue / pause / resume / tick |
| Admin section `factory` | Unified Admin UI (empty list OK) |
| `ELITEEW_FACTORY_AUTONOMOUS` | Default `0` — plan/verify only |
| `ELITEEW_FACTORY_ASYNC_JOBS` | Default `0` — sync ticks; `1` → Celery `ewa_factory` |
| Ops canon | [docker-re_doc/ADMIN-FACTORY-OPS.md](docker-re_doc/ADMIN-FACTORY-OPS.md) |

```bash
bash scripts/eliteew/factory-admin-smoke.sh
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_factory_intention_fsm.py tests/test_factory_celery.py -q
```

## 8.5 Factory atoms + extract-adapt (Wave F6)

| Asset | Role |
|-------|------|
| `ewa_platform/factory/atoms.py` | Parallel factory atom store (`factory_decision` / `factory_verify` / `factory_context`); memory or `ELITEEW_FACTORY_ATOMS_PATH` JSON |
| `context_pack.py` | Stage-aware text pack injected into intention `checkpoint.context_pack` on tick |
| `scripts/eliteew/extract-adapt-map.py` | Harvest JSON + `atom_catalog.yaml` → copy proposals; **dry-run default**; `--apply` requires `ELITEEW_FACTORY_EXTRACT_APPLY=1` + Approval |
| Harvest skill | Markdown report **and** machine JSON → extract CLI → scaffold |
| Sample report | `.cursor/orchestration/reports/harvest-sample-music_forge.json` |

**Not in F6:** companion `ewa_atom` PG with principal FK (optional later); auto-restore of trash trees.

```bash
python3 scripts/eliteew/extract-adapt-map.py \
  --report .cursor/orchestration/reports/harvest-sample-music_forge.json
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_factory_atoms.py tests/test_extract_adapt_map.py -q
```

## 8.6 Config-driven assembly pilot (Wave F7)

| Asset | Role |
|-------|------|
| `ELITEEW_FACTORY_ASSEMBLY` | Master switch — **default OFF**; Admin Factory shows ON/OFF |
| `factory/assembly_gates.py` | Gate T (template freeze) ∧ Gate C (pack golden) — authoritative |
| `factory/gate_t_assets/` | Packaged Gate T freeze mirror (baked image has no `.cursor/`) |
| `POST /assembly/evaluate` | Admin-only; **403** when assembly off |
| Sync tick at `verify` | When assembly ON → `verify_passed` from Gate T∧C |

```bash
# Default: assembly off in Admin status
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_factory_assembly.py -q
```

Enable on runtime (command-center env / config plane — not hardcoded):

```bash
export ELITEEW_FACTORY_ASSEMBLY=1
```

**Not in F7:** full Babel `assemble.mjs`, ECC/EIC control plane, Desktop Gen/Forge Start app.

## 8.7 Admin Topology Map (Wave G1)

| Asset | Role |
|-------|------|
| `api/services/platform_topology/` | Packaged catalog + graph builder |
| `GET /api/v1/desktop/admin/topology` | Admin-only honest graph |
| Admin section `topology` | React Flow cards (deps solid, events dashed) |
| Ops canon | [docker-re_doc/ADMIN-TOPOLOGY-MAP.md](docker-re_doc/ADMIN-TOPOLOGY-MAP.md) |

**Not in G1:** live activity overlay, full health probes for every node, Factory intention badges on nodes (Wave G2 — **Done**, see §8.8).

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_platform_topology.py -q
cd shared/web/frontend && pnpm exec vitest run src/pages/Admin/__tests__/topologyMap.contract.test.ts
```

## 8.8 Factory overlay on Topology Map (Wave G2)

| Asset | Role |
|-------|------|
| `pack_node_map.json` | pack_stem → topology node ids (unknown → `stack0_api`) |
| `factory_overlay.py` | Active intentions → per-node touches |
| Node fields | `factory_touch`, `factory_stage`, `factory_touches[]` |
| Admin badge | Signal ring + `factory · STAGE` on touched cards |

**Not in G2:** live activity edges; companion enqueue; Gate S / Babel (Wave G3 — **Done**, see §8.9).

## 8.9 Deeper factory (Wave G3)

| Asset | Role |
|-------|------|
| `assembly_gates.py` Gate S | Semantic heuristic on packs + optional `intent`; advisory flag on payload |
| Authoritative law | `tc_passed=T∧C`; overall `verdict=apply(T,C,S)` — S **cannot** rescue T/C fail; T∧C pass + S fail → **FAILED** |
| `POST …/intentions/kill-all` | Admin kill switch (`cancel` default / `pause`) |
| `/status.max_fix_loops` | Surfaces `ELITEEW_FACTORY_MAX_FIX_LOOPS` |
| `ELITEEW_FACTORY_EXTRACT_APPLY=1` | Required for `extract-adapt-map.py --apply` (else exit 2) |
| Assembler / Babel | **Deferred** — no `assemble.mjs` pilot without Approval |

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_factory_assembly.py tests/test_extract_adapt_map.py -q
```

**Not in G3:** prod flip of `ELITEEW_FACTORY_AUTONOMOUS=1`; Nervas LLM Gate S; companion→factory enqueue.

## 9. Related

- Editions platform: [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md)
- Platform Ops (Admin adjacency): [docker-re_doc/ADMIN-PLATFORM-OPS.md](docker-re_doc/ADMIN-PLATFORM-OPS.md)
- Topology Map: [docker-re_doc/ADMIN-TOPOLOGY-MAP.md](docker-re_doc/ADMIN-TOPOLOGY-MAP.md)
- Trash policy: [AGENT-TRASH-AND-DELETION-POLICY.md](AGENT-TRASH-AND-DELETION-POLICY.md)
- Agentic substrate (future host patterns): ../product/ewa/`documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]*

**Owner path:** `documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md`
