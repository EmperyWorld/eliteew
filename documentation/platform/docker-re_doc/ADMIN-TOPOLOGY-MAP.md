# Admin Topology Map (Wave G1)

Read-only operator surface in Unified Admin: **honest** platform topology as visual cards linked by declared dependencies and event flows (harvest pattern from genEW ECC Ecosystem Map).

**Not** a live Podman mesh inventer. Edges come only from the packaged catalog aligned with [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current.

## UI

Admin shell → **System** group → **Topology** (`?section=topology`).

| Module | Role |
|--------|------|
| `TopologyAdminSection.tsx` | Load/refresh, KPI row, filters, drawer, honest empty/error |
| `TopologyAdminToolbar.tsx` | Search, band chips, legend strip, map actions |
| `TopologyNodeInspector.tsx` | Drawer — node details + incoming/outgoing edges |
| `TopologyInspectorSection.tsx` | Accordion section for inspector |
| `TopologyMapSkeleton.tsx` | Loading placeholder for canvas |
| `topologyAdminHelpers.ts` | Filter/band/health helpers |
| `TopologyMapCanvas.tsx` | React Flow (`@xyflow/react`) |
| `TopologyServiceNode.tsx` | Service card + health strip |
| `TopologyHealthBadge.tsx` | Reusable health chip |
| `topologyAutoLayout.ts` | Curated band swimlanes + role columns (layout v2) |
| `TopologyBandLaneNode.tsx` | Band backdrop labels inside React Flow |
| `layoutTopologyGraph.ts` | Flow node/edge builders + lane nodes |
| `topologyApi.ts` | Typed client |

Operator UX (Wave G3 polish):

- **KPI row** — visible node count (after filters), dependency/event totals, factory active, last probe time.
- **Search** — label, id, role, band, features (client-side on catalog payload).
- **Band chips** — multi-select filter (`edge`, `prod_core`, `gpu141`, `command_center`); empty set = all bands.
- **Show event flows** / **Show dependencies** — toggles hide edge kinds without mutating catalog.
- **Factory nodes only** — filter to nodes with active Factory overlay.
- **Filter persistence** — search/band/toggles restored from `sessionStorage` for the tab.
- **Node inspector** — click a card → drawer with metadata, factory touches, declared connections.
- **Visual legend** — line swatches instead of plain text only.

Operator UX (Wave G4 polish):

- **Selection highlight** — selected card scales up; neighbors/edges dim; connected edges emphasize.
- **Inspector navigation** — Open neighbor from connections; **Focus on map** recenters viewport.
- **Accordion inspector** — Identity / Features / Factory / Connections sections.
- **Refresh overlay** — soft badge on canvas during 30s auto-refresh (map stays visible).

Auto-refresh every **30s**. Node positions persist in `sessionStorage` (`eliteew.admin.topology.positions.v2`) for the tab (insane coords discarded). Topology key **excludes** health but **includes layout version** so catalog edits and layout bumps reset auto-placement while preserving drag overrides.

### Auto-layout (v2)

Previously: alphabetical √N grid inside each band.

Now: **curated swimlanes** aligned with traffic flow (`topologyAutoLayout.ts`):

| Band | Layout |
|------|--------|
| **edge** | Single ingress node centered above prod_core columns |
| **prod_core** | Seven columns left→right: presentation → **stack0 API hub** → auth/meet/dns → workers → RabbitMQ → data plane → adjunct (llama/OCR/KBSEW) |
| **gpu141** | embed · rerank · tool-router in one row |
| **command_center** | command-center · ComfyUI |

Unknown catalog ids fall back to **role lane** + stable label order. Operator drag still wins via sessionStorage; **Reset layout** clears overrides and reapplies v2 slots.

Band labels render as non-interactive **swimlane backdrop nodes** inside React Flow (pan/zoom with the map).

**Prod release:** `prod-baked-20260817-2003` (deploy_id `1786961071240-mltm2p0y28`, git `d447420f1`).

Canvas: fixed height `min(72vh, 680px)` / min 500px, `colorMode=dark`, deferred `fitView` after `nodesInitialized` (Desktop `uiScale` + Admin shell transform break first-paint fit). Operator **Fit view** / **Reset layout** in the toolbar.

### Factory overlay (Wave G2)

Active (non-terminal) Gen/Forge intentions are mapped onto catalog nodes via `pack_node_map.json` (`pack_stem` → node ids). Unknown packs fall back to `stack0_api`.

| UI signal | Meaning |
|-----------|---------|
| Signal ring + `factory · STAGE` badge | Node has ≥1 active intention |
| `×N` | Multiple active touches on the same node |
| Counts line `factory A · touched B` | Active intentions / nodes with badges |

Overlay **annotates** nodes only — never invents edges.

### Legend

| Edge / cue | Meaning |
|------|---------|
| Solid | Hard dependency (`dependencies` in catalog) |
| Dashed / animated | Declared event/AMQP/OIDC flow (`event_flows`) |
| Health `unknown` | No local probe in Wave G1 — **not** the same as down |
| Factory badge | Active Factory intention mapped via pack_node_map |

## API

Mounted under `/api/v1/desktop/admin/topology` (desktop admin router).

| Method | Path | Auth | Role |
|--------|------|------|------|
| `GET` | `/` (prefix `/topology`) | OAuth2 | `admin` or `emperyworld_admin` |

No POST/apply endpoints.

### Payload

- Packaged catalog: `shared/api/services/platform_topology/data/topology_catalog.json`
- Builder: `api/services/platform_topology/graph_builder.py`
- Local health overlay (Wave G1): `stack0_api` → `ok` while this process serves; all other nodes → `unknown`
- Factory overlay (Wave G2): non-terminal intentions → `factory_touch` / `factory_stage` on mapped nodes

## Catalog edit

1. Edit `topology_catalog.json` (nodes / dependencies / event_flows).
2. Edit `pack_node_map.json` when new recipe packs should light up different nodes.
3. Keep node ids unique; every edge endpoint must exist; pack map targets must be catalog ids.
4. Run: `cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_platform_topology.py -q`
5. Deploy via normal stack0 release (catalog ships inside API image).

## Related

- Harvest program: [ELITEEW-GENEW-FACTORY-HARVEST.md](../ELITEEW-GENEW-FACTORY-HARVEST.md)
- Platform ops (adjacent): [ADMIN-PLATFORM-OPS.md](ADMIN-PLATFORM-OPS.md)
- Unified Admin shell: [UNIFIED-ADMIN-SHELL.md](../UNIFIED-ADMIN-SHELL.md)
- genEW source pattern: `/data/repos/genEW/apps/empery_control_center/src/features/ecosystem-map/`
