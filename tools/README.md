# tools/ — host developer & CI utilities

Not shipped into stack0 API images. Not operator deploy CLI (that is `docker/scripts/`).

| Path | Role |
|------|------|
| `architecture_guard/` | Domain-boundary import / sys.path guard (`domain_matrix.json`) |
| `check_all.sh` | Local/CI chain: Architecture Guard → U3 guard → Ruff → Biome |
| `eliteew-kbsew-mcp/` | Cursor MCP server over KBSEW corpus |

## Adjacent trees (do not merge casually)

| Tree | Role |
|------|------|
| `shared/tools/` | Neutral packages **baked/mounted** into API (`/app/shared_tools` runtime alias) |
| `scripts/` | Host shell wrappers (`scripts/eliteew/`, meet-media, backups) |
| `docker/scripts/` | Canonical ops CLI (`eectl`, `eeprodbaked`, `eeprodline`, …) |

Canon: [ELITEEW-PACK-LAYOUT.md](../documentation/platform/ELITEEW-PACK-LAYOUT.md)
