# Desktop observation catalog, v1

Reference · checked against source on 2026-10-11. [DesktopObservationKind and its runtime predicate](../contracts/desktop_observation.py) define four client observations. This reference describes minimum runtime validation rather than promising full JSON Schema parity.

## Kinds and accepted fields

- `window_list_snapshot`: `windows` must be a list. The runtime predicate does not validate each item, although [the JSON Schema](../schemas/json/desktop_observation_v1.json) requires object items.
- `active_app_changed`: both `app_component` and `window_id` must be nonblank strings. Nullable dataclass annotations/schema properties do not make null values valid for the HTTP entry.
- `intent_execution_failed`: nonblank `intent_kind` and `reason`; `detail` is optional. The minimal runtime predicate does not check `detail`'s type or that `intent_kind` names a known intent.
- `user_cancelled`: `reason` must be a nonblank string. The dataclass can represent `None`, but that representation fails runtime validation.

Unknown additional fields are not rejected by this predicate. The schema requires only `observation_kind` and does not encode all conditional requirements; acceptance sets differ (DOC-CODE-008 in [the issue log](../../../../docs/CODE_ISSUES.md)). The historical AMKA title/id in schema metadata does not change the EWA HTTP mount.

## Serialization and orchestration behavior

[desktop_observation_to_wire](../io/desktop_payload.py) serializes the four dataclasses; `ensure_desktop_observation_wire_or_raise` performs the minimum shape check and raises `ValueError`. The [HTTP runtime](../desktop/runtime.py) maps that validation failure to 400.

```json
{"observation_kind":"active_app_changed","app_component":"DocEditor","window_id":"window-1"}
```

[The orchestrator](../core/orchestrator.py) derives a `focus_window` heuristic from an active-app change. Cancellation produces no heuristic, but the model is still called and a valid model intent can take precedence. A window snapshot or failure observation has no built-in heuristic. Do not interpret `user_cancelled` as an unconditional model bypass or session deletion.

Large snapshot references are a possible future extension; no `storage_ref` observation is implemented by this contract.

Related: [intent catalog](INTENT-CATALOG.md), [model/policy flow](POLICY-LLM-MATRIX.md), [HTTP entry](DESKTOP-ORCHESTRATION.md).
