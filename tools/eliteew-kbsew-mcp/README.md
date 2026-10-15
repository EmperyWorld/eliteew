# KBSEW MCP server

This independent Python package exposes KBSEW retrieval through the MCP Python SDK. [pyproject.toml](pyproject.toml) declares Python >=3.11, `mcp>=1.9,<2`, `httpx>=0.28` and the `eliteew-kbsew-mcp` entry point. Package licensing is in [LICENSE](LICENSE).

[server.py](eliteew_kbsew_mcp/server.py) registers five tools: `kbsew_list_barrels`, `kbsew_list_drivers`, `kbsew_health`, `kbsew_resolve_corpus` and `kbsew_search`. [Corpus mapping](eliteew_kbsew_mcp/corpus.py) resolves `docs`, `api` and `fe` against barrel names. Search accepts a barrel id or corpus, clamps `limit` to 1–20 and accepts dense/hybrid retrieval; unsupported modes fall back to dense. Results are JSON encoded as tool text. This server does not provide ingestion/deletion tools.

## Configuration

- `KBSEW_SERVICE_URL`: service base URL; default `http://127.0.0.1:28030`.
- `KBSEW_INTERNAL_SERVICE_TOKEN`: matching service token for authenticated KBSEW reads; no built-in secret value.
- `ELITEEW_KBSEW_MCP_HTTP_TIMEOUT`: HTTP timeout, default 60 seconds.
- `ELITEEW_KBSEW_MCP_TRANSPORT`: default stdio; HTTP aliases select streamable HTTP.
- `ELITEEW_KBSEW_MCP_HOST` / `ELITEEW_KBSEW_MCP_PORT`: HTTP bind, default loopback and 28130.

For a configured, reachable KBSEW service:

```bash
cd tools/eliteew-kbsew-mcp
uv sync
# Supply KBSEW_SERVICE_URL and KBSEW_INTERNAL_SERVICE_TOKEN securely.
uv run eliteew-kbsew-mcp
```

Use `uv run` or the environment's installed executable; `uv sync` alone does not add the command to the invoking shell's PATH. The installation/start command was inspected, not executed during this audit.

[run-cursor-mcp.sh](run-cursor-mcp.sh) is the repository's stdio wrapper and reads the local token path. Inspect its environment/startup behavior before wiring it into a local client. No local MCP configuration or token was changed. HTTP transport does not by itself establish an externally secured deployment; use the intended local/client boundary.

[Tests](tests/test_kbsew_mcp_server.py) cover the adapter with mocks. The host/server canon is [ELITEEW-MCP-HOST-AND-SERVERS](../../documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md); service details are in [KBSEW](../../KBSEW/README.md).
