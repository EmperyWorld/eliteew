# EliteEW MCP Host and servers

Living canon for connecting **Model Context Protocol** servers to Ассистент, Assistant, Cursor, and future surfaces.

## Scope

- **In scope:** stack0 MCP Host (`api/services/mcp_host/`), meta-tools `mcp_list` / `mcp_call`, servers `eliteew-kbsew-mcp` / native `kbsew` + shared **research** (`research_native`: web / chat RAG / vault), license/telemetry policy.
- **Out of scope (v1):** arbitrary remote MCP URL without allowlist, third-party MCP catalogs, chroma-code.

## License and telemetry policy (HARD)

Allowed MCP servers must be:

- License **MIT** or **Apache-2.0**
- **No** required telemetry / phone-home / account gate for basic tools

Official dependency: [`modelcontextprotocol/python-sdk`](https://github.com/modelcontextprotocol/python-sdk) (`mcp` on PyPI, MIT). Pin in stack0: `mcp>=1.9.0,<2` (`docker/builders/stack0-api/requirements/api.in`).

Reject entries with `telemetry_ok: true` or unknown license at config load.

## Architecture

```text
Ассистент ──mcp_list/mcp_call──► MCP Host (stack0)
Assistant    ──mcp_list/mcp_call──► MCP Host
Cursor IDE       ──stdio──────────────► eliteew-kbsew-mcp ──HTTP──► stack-kbsew
MCP Host kbsew_native ───────────────────────────────HTTP──► stack-kbsew → Qdrant
MCP Host research_native ──► research_tools → ensemble runners (web/RAG/vault)
```

Product Host prefers **`kbsew_native`** and **`research_native`** (in-process) so Desktop/companion do not depend on a sidecar process for those tools. Cursor uses the stdio MCP package under `tools/eliteew-kbsew-mcp/`.

## Enablement

| Gate | Default | How |
|------|---------|-----|
| Host | **OFF** | Env `ELITEEW_MCP_HOST_ENABLED=1` **and/or** desktop admin defaults `mcp_host_enabled: true` |
| Servers | default `kbsew` / `kbsew_native` + `research` / `research_native` | Optional `ELITEEW_MCP_SERVERS_JSON` array |

**Surface nuance:** Ассистент resolves `mcp_host_enabled` from admin chat defaults (and env). **Assistant** checks **env only** (`ELITEEW_MCP_HOST_ENABLED`) — set the env in stack0 runtime (materializes into `.env.stack0.shared`) for companion tools. Prod ops (2026-08-09): host enabled via env + defaults; MCP Host code on **dev-bind line B** until next baked `release stack0 --all` (includes `mcp` SDK for optional stdio transport).

Example allowlist JSON:

```json
[
  {
    "id": "kbsew",
    "transport": "kbsew_native",
    "license": "MIT",
    "telemetry_ok": false,
    "surfaces": ["desktop", "ewa", "cursor", "ops"]
  },
  {
    "id": "kbsew-stdio",
    "transport": "stdio",
    "license": "MIT",
    "telemetry_ok": false,
    "surfaces": ["ops"],
    "command": ["eliteew-kbsew-mcp"],
    "env": { "KBSEW_SERVICE_URL": "http://stack-kbsew:8030" }
  }
]
```

Surfaces: `desktop` (Ассистент), `ewa` (companion registry), `cursor`/`ops` (documentation / future).

## Tools (Host meta)

| Tool | Args | Behavior |
|------|------|----------|
| `mcp_list` | optional `server_id` | List servers, or tools for one server |
| `mcp_call` | `server_id`, `tool`, `arguments` | Call allowlisted server tool |

KBSEW tools (native + MCP server):

| Tool | Args |
|------|------|
| `kbsew_list_barrels` | — |
| `kbsew_list_drivers` | — |
| `kbsew_health` | — |
| `kbsew_resolve_corpus` | `corpus` (`docs`\|`api`\|`fe` or full `eliteew-*` name) |
| `kbsew_search` | `query`, `barrel_id` **and/or** `corpus`, optional `limit`, `retrieval_mode` |

Research tools (`server_id=research`, transport `research_native`) — reuse ensemble runners via `api/services/research_tools/`; require call-site context (Desktop injects user/chat/project; deny without context):

| Tool | Args |
|------|------|
| `web_search` | `query` (also needs admin `tools_web_search_enabled` + chat `use_web_search`) |
| `chat_rag_search` | `query` (+ `chat_id`) |
| `project_vault_search` | `query` (+ `project_id` + project RAG) |

## eliteew-kbsew-mcp package

Path: [`tools/eliteew-kbsew-mcp/`](../../tools/eliteew-kbsew-mcp/). MIT LICENSE. Transports: stdio (Cursor) or Streamable HTTP (`ELITEEW_KBSEW_MCP_TRANSPORT=streamable-http`).

## Repo index barrels (docs / code)

Canonical living store remains **KBSEW → Qdrant** (not chroma-code). Target barrels:

| Barrel name | driver_type | Tree |
|-------------|-------------|------|
| `eliteew-docs` | `markdown` | `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/` |
| `eliteew-api` | `code_python` | `shared/api/**/*.py` |
| `eliteew-frontend` | `code_typescript` | `shared/web/frontend/src/**/*.{ts,tsx}` |

Sync: `bash docker/scripts/kbsew-sync-repo-barrels.sh --barrel docs|api|fe` (admin JWT required). Details: [product/KBSEW.md](../product/KBSEW.md) §Repo barrel sync.

## Failure / Edge cases

| Axis | Behavior |
|------|----------|
| Offline | `mcp_call` / native tools return JSON `{"error":…}`; companion `mcp_call` sets `status=error` when payload has `error` (no fake success) |
| Dual-flag | Surface not in server `surfaces` → deny |
| Permission | Host allowlist only; mutations not exposed via KBSEW MCP tools |
| Stdio hang | `ELITEEW_MCP_STDIO_TIMEOUT_SEC` (default 45, clamp 5–300); list/call wrapped in `asyncio.wait_for`; child env = allowlisted base keys + `cfg.env` only |
| Regression | Host: `shared/api/tests/test_mcp_host.py`. Package: `cd tools/eliteew-kbsew-mcp && PYTHONPATH=. pytest tests/test_kbsew_mcp_server.py -q` |

## Related

- [product/KBSEW.md](../product/KBSEW.md)
- [product/DESKTOP-LLAMA-CHAT.md](../product/DESKTOP-LLAMA-CHAT.md)
- Host code: `shared/api/services/mcp_host/`
- Desktop tools: `shared/api/services/desktop_chat/tools/mcp_tools.py`
- Companion: `handlers_mcp.py` (`mcp_list`, `mcp_call` in REGISTRY)
