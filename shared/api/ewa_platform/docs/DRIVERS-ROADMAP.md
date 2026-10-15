# EWA domain drivers: implementation and extension boundaries

Reference · checked against source on 2026-10-11. The historical filename is retained for callers. This document distinguishes existing protocols/adapters from proposed mutation capabilities; it is not a competing implementation plan.

## Current composition

[OrchestrationContext](../core/orchestration_context.py) has one executable shell port and optional UGS/documents/content hint ports. [desktop/runtime.py](../desktop/runtime.py) constructs the selected instances directly. [drivers/registry.py](../drivers/registry.py) is an opt-in process registry; declaring an id or importing a module does not register/enable a driver.

- Shell: [DesktopShellDriver](../drivers/desktop_shell.py), id `eliteew_desktop`, default [FakeDesktopDriver](../testing/fake_desktop_driver.py). With `EWA_ORCH_USE_ELITEEW_HTTP` and a bearer token, [EliteEwDesktopHttpDriverStub](../adapters/eliteew_desktop_http.py) performs real HTTP shell/config patches. Despite its historical class name it is not a no-op; window/open/deep-link intents remain unsupported by this adapter.
- UGS: [UgsControlDriver](../drivers/ugs_control.py), id `ugs_control`. [The HTTP adapter](../adapters/eliteew_ugs_http.py) reads either model-routing or generation-inventory core alignment. It returns a bounded list of top-level keys, not a complete UGS state. It does not mutate generation settings.
- Documents: [DocumentsWorkspaceDriver](../drivers/documents_workspace.py), id `documents_workspace`, `READ_ONLY`. [The shell hint adapter](../adapters/eliteew_shell_domain_hints_http.py) derives hints from persisted `ewa_hints.documents_workspace` or a shell-window fallback; it does not query full document bodies through this port.
- Content: [ContentManagerDriver](../drivers/content_manager.py), id `content_manager`, `READ_ONLY`. The same adapter derives roots from `ewa_hints.content_manager` or content shortcuts; it is not a catalog mutation driver.
- Ambient: registry id `ewa_companion_ambient` and [ambient protocol](../drivers/ambient_driver.py) are separate from the desktop turn's optional hint ports. Companion ambient expansion is implemented in [actions/ambient.py](../companion/actions/ambient.py).

Documents/content fallback projections reflect supplied shell metadata, not verified current editor/file state. Optional hints are collected concurrently and exceptions degrade hints; they do not cancel the turn. Documents/content share one cached shell-state request per turn.

## Configuration and wire shape

UGS hint selection uses `EWA_ORCH_ATTACH_UGS_HTTP` and `EWA_ORCH_UGS_PROFILE` (`model_routing` or `generation_inventory`). Documents/content use `EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT` and `EWA_ORCH_ATTACH_CONTENT_SHELL_HINT`. All these HTTP ports require the incoming bearer token.

[HttpClientConfig](../adapters/http_client_config.py) defaults to a 30-second timeout and TLS verification. Runtime self-HTTP uses `unified_settings.eliteew_self_http_base_url` (override `ELITEEW_SELF_HTTP_BASE_URL`), not the public ingress URL. Hint schemas/normalizers live in [domain_hints_wire.py](../contracts/domain_hints_wire.py), [ewa_shell_hints_wire.py](../contracts/ewa_shell_hints_wire.py) and [domain_hints_v1.json](../schemas/json/domain_hints_v1.json).

## Adding a capability

Introduce an explicit protocol, compatible wire contract and fake, then an adapter and composition wiring. [DomainActionRiskTier](../contracts/domain_driver_snapshots.py) defines risk-tier names; it does not by itself authorize a mutation. New document/content write capabilities need an explicit policy/consumer decision and tests. Existing companion document/file tools are a different execution path and do not make these hint ports writable.

Do not import marketing `api.services.amka_core` into EWA as the implementation of a new driver. The marketing code can be inspected as historical design evidence. [AmkaDriver](../drivers/protocol.py) is the retained name of the minimal `driver_id`/`ping` registry protocol, not the marketing HTTP entry.

No billing/ticketing driver is established by the earlier placeholder list. New envelope fields or incompatible intent changes require consumer versioning; do not assume a v2 route/schema exists.

Related: [driver/action catalog](EWA-APP-DRIVER-CATALOG.md), [desktop HTTP reference](DESKTOP-ORCHESTRATION.md), [policy/model flow](POLICY-LLM-MATRIX.md), [extension/test order](FILL-ORDER.md).
