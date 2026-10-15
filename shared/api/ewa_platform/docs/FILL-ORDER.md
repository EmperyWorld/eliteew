# EWA implementation dependency and test guide

Developer reference · checked against source on 2026-10-11. This file retains the useful dependency order from the original scaffold plan. The package now contains working desktop, companion, agentic, persistence and worker implementations; the numbered order is not an unfinished scaffold checklist or deployment acceptance record.

## Extending the desktop orchestration boundary

1. Define compatible [contracts](../contracts/) and [JSON/Pydantic schemas](../schemas/). Compare schemas with actual runtime validation and consumers; they currently have documented parity gaps.
2. Update mapping/serialization helpers in [io](../io/), including both typed serializers and minimum wire predicates.
3. Define persistence ports in [orchestration_ports.py](../persistence/orchestration_ports.py); exercise [memory stores](../persistence/in_memory_orchestration.py) and separately verify the [PG implementation](../persistence_pg/orchestration_asyncpg.py).
4. Add a domain protocol in [drivers](../drivers/), a fake in [testing](../testing/) and an adapter in [adapters](../adapters/). [Registry keys](../drivers/registry.py) do not automatically register live drivers.
5. Add explicit [policy](../policy/) and model proposal/schema behavior in [llm](../llm/). The server policy remains the gate after model selection.
6. Compose the ports in [OrchestrationContext](../core/orchestration_context.py) and [desktop/runtime.py](../desktop/runtime.py); keep the turn flow in [core/orchestrator.py](../core/orchestrator.py).
7. Update the thin [HTTP/SSE router](../gateways/routers/desktop.py), typed [SPA client](../../../web/frontend/src/services/ewa/ewaDesktopOrchApi.ts) and affected observation consumers. New driver capabilities do not automatically reach the chat action channel.
8. Reconcile [intent](INTENT-CATALOG.md), [observation](OBSERVATION-CATALOG.md), [driver](DRIVERS-ROADMAP.md) and [HTTP](DESKTOP-ORCHESTRATION.md) references in the same change.

## Existing bounded regression suite

From the repository root, with the existing root virtual environment:

```bash
cd shared/api
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=.. ../../.venv/bin/python -m pytest   -o cache_dir=/tmp/eliteew-documentation-pytest   tests/test_ewa_platform_orchestration_skeleton.py   tests/test_ewa_platform_intent_proposal.py   tests/test_ewa_platform_fill_order_wiring.py -q
```

Audit result: **26 passed**. This covers fakes, wiring and proposal parsing, not a production model/database/browser. The existing [HTTP route tests](../../tests/test_ewa_platform_desktop_http_route.py) stalled in this session's synchronous TestClient path and were interrupted; they are not reported as passed. Isolated ASGI checks reproduced the defects in [the append-only issue log](../../../../docs/CODE_ISSUES.md).

[AsyncPG orchestration tests](../../tests/test_ewa_platform_orchestration_asyncpg.py) require their own explicitly selected test database. No database migration or live integration test was run during this documentation iteration.

Related: [module entry](../README.md), [norms](../GOALS-AND-NORMS.md), [developer setup](../../../../documentation/platform/DEVELOPER-SETUP.md).
