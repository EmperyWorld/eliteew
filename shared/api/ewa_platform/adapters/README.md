# EWA external adapters

These modules implement domain protocols with HTTP. The desktop orchestration runtime selects them explicitly; they are not enabled by importing the package.

- [Desktop HTTP](eliteew_desktop_http.py): reads shell state and executes shell/config patches. Other desktop intent kinds return a structured negative result.
- [UGS HTTP](eliteew_ugs_http.py): read-only core-alignment key summaries, id `ugs_control`.
- [Shell domain hints](eliteew_shell_domain_hints_http.py): read-only document/content projections with one per-turn shell-state cache and explicit-hint/fallback handling.
- [Client configuration](http_client_config.py): connection URL/path, 30-second default timeout and TLS verification; bearer tokens are passed separately.

Protocols live in [drivers](../drivers/), runtime wiring in [desktop/runtime.py](../desktop/runtime.py). `contracts/` does not perform these HTTP calls. See [driver boundaries](../docs/DRIVERS-ROADMAP.md) and [desktop orchestration](../docs/DESKTOP-ORCHESTRATION.md).
