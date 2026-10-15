# EWA HTTP and SSE gateways

The gateways are implemented. [companion_http.include_ewa_routers](companion_http.py) is the facade that mounts EWA routers under `/api/v1/ewa` in the shared FastAPI application; [API domain registration](../../domains/bi_ugs.py) invokes it.

[routers](routers/) contains desktop orchestration, companion profile/chat/admin/plans/workflows, agentic sessions, ESP display and runtime context/command entries. Their bodies/responses are not all instances of the generic EWA envelope: each router declares its own Pydantic/raw-body contract.

[desktop_http.py](desktop_http.py) maps the desktop turn envelope; [desktop_sse.py](desktop_sse.py) formats orchestration event snapshots and keep-alive comments. `follow=true` on this SSE route keeps the connection alive; it does not poll new journal rows. Other companion/agentic streams have separate implementations.

[runtime_gateway](runtime_gateway/) implements product context/command service logic. Routers delegate to desktop/companion/runtime helpers and persistence; importing a gateway does not import or start `main`.

Related: [desktop HTTP reference](../docs/DESKTOP-ORCHESTRATION.md), [registered API source catalog](../../../../documentation/api/REGISTERED-ROUTES.md), [module entry](../README.md).
