# Architectural Integrity Sentinel (AIS) — Rules

AIS guards **architectural drift** in the EliteEW realtime stack. It complements functional pytest/Vitest
contract tests and the monorepo `tools/architecture_guard/` domain-matrix guard.

## Rule catalog

| ID | Layer | Rule | Severity |
|----|-------|------|----------|
| **AIS-SIO-01** | Contract | Inbound `@sio.event` handlers with a `data` parameter must call `parse_socket_event` before reading payload fields. | ERROR |
| **AIS-SIO-02** | Contract | Inbound handlers must not use `data.get(` (type erosion to raw dict). Use validated Pydantic model attributes. | ERROR |
| **AIS-SIO-03** | Contract | Inbound handlers must not call `json.loads` on the raw `data` parameter. | ERROR |
| **AIS-ID-01** | Observability | `resolve_realtime_correlation_id` returns the same id when clients pass the same trace header via Socket.IO auth, WS query, or HTTP headers. | ERROR |
| **AIS-ID-02** | Observability | `bind_realtime_trace` logs `[AIS:realtime_trace] bootstrap correlation_id=…` and raises on empty correlation (CRITICAL FAILURE, not PASS). | ERROR |
| **AIS-PERF-01** | Performance | `parse_socket_event(CursorMoveEvent, …)` — 1000 validations must stay within baseline `max_ms_per_1000_validations` (+10% CI slack). | ERROR |

### Allowlist (AIS-SIO-*)

Handlers exempt from inbound validation rules:

- `connect`, `disconnect` — transport lifecycle, not typed payloads
- `test_event` — debug-only echo

## Baseline updates (false positives)

When schema or validation logic legitimately changes overhead:

```bash
AIS_UPDATE_BASELINE=1 bash docker/scripts/run-ais-sentinel.sh
```

This rewrites `tests/architecture/baseline/cursor_move_validation_baseline.json` with measured timings.

## Integration

| Entry | Command |
|-------|---------|
| **AIS only** | `bash docker/scripts/run-ais-sentinel.sh` |
| **Socket regression slice** | `bash docker/scripts/run-socket-tests.sh tests/architecture/ -q` |
| **Full API container** | `bash docker/scripts/run-stack0-api-tests.sh tests/architecture/ -q` |
| **Local (host venv)** | `cd shared/api && uv run pytest tests/architecture/ -q` |

Recommended PR gate addition (after hygiene job): run `run-ais-sentinel.sh` — adds &lt;10s vs full pytest.

## Related canon

- `api/routers/socketio_event_schemas.py` — inbound Pydantic strict schemas
- `api/core/realtime_trace_context.py` — cross-transport correlation binding
- `documentation/platform/ELITEEW-TECH-STACK-SUMMARY.md` §8 — contract breach tracker
