# shared/tools — neutral packages shipped into stack0 API

Python packages that are **not** product mid (`shared/api`) but must be importable from the API process.

| Package | Role |
|---------|------|
| `i18n_rewriter` | Desktop admin i18n rewrite via stack2 |

## Path contract

| Where | Path |
|-------|------|
| **Host (SoT)** | `shared/tools/` |
| **Container / NFS export alias** | `/app/shared_tools` · export dir `shared_tools/` |

Bake: `COPY shared/tools /app/shared_tools`. Dev-bind mounts export `shared_tools` → `/app/shared_tools`. Resolver: `shared/api/shared_tools_path.py` (env `ELITEEW_SHARED_TOOLS_DIR` optional).

## Not this tree

| Tree | Role |
|------|------|
| `tools/` | Host-only developer / CI utilities (architecture guard, MCP, `check_all`) |
| `scripts/` | Operator/host shell wrappers (`scripts/eliteew/`, backups); deploy CLI stays in `docker/scripts/` |
| `shared/packages/` | Private pnpm `@eliteew/*` workspace packages |

Canon: [ELITEEW-PACK-LAYOUT.md](../../documentation/platform/ELITEEW-PACK-LAYOUT.md)
