# Atomic router decomposition — architecture canon

**Status:** mandatory standard for new and refactored FastAPI routers under `shared/api/routers/`.  
**Milestone reference:** desktop router god-file remediation (EV-02) — completed **2026-07-04**.  
**Completion report:** soft-retired one-shot → `trash/` (`DESKTOP-ROUTER-DECOMPOSITION-COMPLETE-2026-07-04.md`). Living pattern locks are **this document** + product router layout (e.g. [DESKTOP-LLAMA-CHAT.md](../product/DESKTOP-LLAMA-CHAT.md) — includes `discussion` child). Dated AI-chat split note `DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md` soft-retired → `trash/`.

---

## 1. Why this canon exists

The monolithic `desktop.py` (~2931 LOC) was decomposed into domain modules without changing public URLs. This document locks the pattern so future agents and developers **do not re-grow god-files**.

Reference tree (desktop domain, post-atomization):

| Module | Role | Approx. LOC |
|--------|------|-------------|
| `desktop.py` | Parent: store policy, mounts, re-exports | ~400 |
| `desktop_shell.py` | **Aggregator only** — mounts config + proxy, re-exports | ~65 |
| `desktop_shell_config.py` | **Aggregator only** — mounts config + shell-state routes, re-exports | ~96 |
| `desktop_shell_config_routes.py` | Theme/wallpaper config, `GET/POST/PATCH/PUT /config` | ~393 |
| `desktop_shell_state_routes.py` | `GET/PATCH /shell-state`, wire models, field ETags, P2 lock/idempotency | ~700 |
| `desktop_shell_state_sanitize.py` | `shell_state` JSON caps and `_sanitize_*` helpers | ~545 |
| `desktop_shell_etag.py` | Stable JSON digest + weak ETag + `If-None-Match` match | ~48 |
| `desktop_shell_proxy.py` | Local-service iframe proxy (httpx streaming) | ~193 |
| `desktop_store.py` | App Store, installed apps, billing | ~685 |
| `desktop_widgets.py` | Widget notes/todos, favorites | ~468 |
| `desktop_workspace.py` | **Aggregator only** — mounts children, re-exports | ~50 |
| `desktop_items.py` | Items/folders CRUD, reconciliation | ~820 |
| `desktop_recents.py` | Recent files / content feed | ~240 |
| `desktop_bootstrap.py` | System folders, App Store icon, legacy cleanup | ~255 |
| `desktop_admin_schemas.py` | Admin Pydantic schemas (consumed by `desktop_admin.py`) | ~380 |

---

## 2. Pattern: Atomic router decomposition

### 2.1 Size gate

| Rule | Detail |
|------|--------|
| **No router module > 1000 LOC** | Split by domain before adding features; parent routers target **400–600 LOC** (orchestration + policy only). |
| **Aggregator routers < 200 LOC** | e.g. `desktop_workspace.py` — mount + re-export only, no route handlers. |
| **Target LOC in plan** | Structural tasks must state parent and child LOC targets before extraction (see `task-intake-and-risk-gate.mdc`). |

### 2.2 One domain per module

- Each HTTP domain gets **`api/routers/<domain>.py`** (or nested name: `desktop_items.py`, not a second god-file).
- Schemas/helpers used **only** by that domain live in the same module unless shared across ≥2 domains — then extract to `*_schemas.py` or `services/`.

### 2.3 Re-export pattern (backward compatibility)

When splitting module `parent.py` into `child.py`:

1. Move symbols to `child.py`.
2. In the **immediate parent** (aggregator or `desktop.py`):

   ```python
   from api.routers.child import SymbolA, SymbolB  # noqa: F401
   ```

3. **Do not** change import sites in `desktop_shell.py` (aggregator), `desktop_shell_config.py`, `desktop_store.py`, tests, or admin routers unless explicitly migrating the whole chain.

Consumers that imported from `api.routers.desktop` or `api.routers.desktop_workspace` must keep working.

### 2.4 Mount contract (URL stability)

```python
child = APIRouter(tags=["desktop"])  # no extra prefix
parent.include_router(child.router)
```

- Public paths stay **`/api/v1/<parent-prefix>/…`** (domain registration in `api/domains/` unchanged).
- **Forbidden:** adding `prefix="/items"` on a child when parent already uses `/desktop` — duplicates or breaks paths.

Verify after every split:

```bash
# Example: desktop items unchanged
rg '@router\.(get|post|put|patch|delete)\("/items' shared/api/routers/desktop_items.py
```

### 2.5 Dependency direction (no cycles)

Allowed dependency flow for desktop (reference):

```text
desktop.py (policy constants, get_desktop_user_id)
    ↑ lazy _desktop() in children
desktop_shell / desktop_store / desktop_items / desktop_recents / desktop_bootstrap
    ↑ import bootstrap helpers only where needed
desktop_workspace.py → mounts recents + items; re-exports only
```

**Hard rules:**

| From | Must NOT import |
|------|-----------------|
| `desktop_bootstrap` | `desktop_workspace`, `desktop_items` |
| `desktop_items` | `desktop_workspace` |
| `desktop_recents` | `desktop_items`, `desktop_workspace` |
| `desktop_workspace` | route logic (only mounts + re-exports) |

Use **lazy import** inside functions for:

- `get_desktop_user_id` from `desktop.py`
- `_desktop()` policy accessor in items/store paths
- `KNOWN_DESKTOP_APP_COMPONENTS` in admin schemas

### 2.6 Phase 0 before extraction

Before moving code, produce a short **Dependency Impact Analysis**:

- Clusters (routes, schemas, helpers) + estimated LOC
- External importers (grep re-exports)
- Shared glue (reconciliation, bootstrap on read)
- Proposed mount order and re-export list

See workspace split migrations under `documentation/product/desktop/DESKTOP-ROUTER-*-SPLIT-MIGRATION-2026-07-04.md`.

---

## 3. Verification checklist (structural changes)

Owned by `.cursor/rules/agent-code-verification.mdc` and `documentation/platform/AGENT-CODE-VERIFICATION-WORKFLOW.md` §4.6.

| Check | Pass criteria |
|-------|----------------|
| **Import chain** | `from api.routers.desktop import …` and legacy paths still resolve |
| **Dependency direction** | No new cycle between shell / items / workspace / bootstrap |
| **URL stability** | OpenAPI path list or grep of `@router.*("/…")` unchanged for moved routes |
| **Regression** | Narrow pytest slice for domain + import-chain test file |

Example desktop slice:

```bash
bash docker/scripts/run-stack0-api-tests.sh tests/test_desktop_items_import_chain.py \
  tests/test_desktop_bootstrap.py tests/test_desktop_recents_mappers.py \
  tests/ -k "desktop_item or desktop_items or desktop_bootstrap or desktop_rec" -q
```

---

## 4. Migration doc template

Each extraction phase gets a file:

`documentation/product/<area>/DESKTOP-ROUTER-<DOMAIN>-SPLIT-MIGRATION-YYYY-MM-DD.md`

Sections: Summary, What moved, Mount contract, Re-export chain, Verification command, Related.

When a decomposition **program** closes, keep this canon + the phase migration note current; do **not** resurrect the soft-retired EV-02 completion dump from `trash/` as a living hub.

---

## 5. Related rules and docs

| Topic | Owner |
|-------|--------|
| Semantic verification | `agent-code-verification.mdc`, `AGENT-CODE-VERIFICATION-WORKFLOW.md` |
| Structural task intake | `task-intake-and-risk-gate.mdc` |
| Domain boundaries | `domain-boundary-gate.mdc`, `AGENT-DOMAIN-BOUNDARY-GATE.md` |
| Commit closeout | `verified-proposal-protocol.mdc`, `AGENT-VERIFIED-PROPOSAL-PROTOCOL.md` |
| Desktop persistence / API table | `product/desktop/DESKTOP-STATE-PERSISTENCE.md` |
| Stability / remediation backlog | [PRODUCT-AUDIT-STABILITY-BACKLOG.md](PRODUCT-AUDIT-STABILITY-BACKLOG.md) · [ENGINEERING-GOVERNANCE-MANIFESTO.md](ENGINEERING-GOVERNANCE-MANIFESTO.md) (historical `MASTER_RE_MEDIATION_BACKLOG` → `trash/`) |

---

*Post-refactoring governance: modular routers are the default; monolithic routers are a regression.*
