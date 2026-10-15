# Desktop intent catalog, v1

Reference · checked against source on 2026-10-11. These are mapping-based intents accepted by the desktop orchestration contract. Permission to propose an intent and support for executing it are separate checks.

## Discriminators and minimum runtime fields

[DesktopIntentKind and the runtime predicate](../contracts/desktop_intent.py) define six kinds:

- `open_app`: nonblank `app_component`; `payload` is carried by the typed dataclass/serializer but is not required by the minimum runtime predicate.
- `focus_window`: nonblank `window_id`.
- `close_window`: nonblank `window_id`.
- `patch_shell_state`: `patch` must be a mapping; an empty mapping passes this structural check.
- `patch_desktop_config`: `patch` must contain at least one value accepted by [the config sanitizer](../contracts/desktop_config_patch_wire.py). The sanitizer selects supported personalization fields and normalizes themes to `DARK`, `LIGHT` or `AUTO`.
- `navigate_deep_link`: nonblank `deep_link_token`; `payload` is carried by the typed representation but is not required by the minimum predicate.

The predicate does not enforce the JSON Schema's `additionalProperties: false`. The [checked-in schema](../schemas/json/desktop_intent_v1.json) does not enforce all per-kind required fields. Do not treat schema acceptance as runtime acceptance; see DOC-CODE-008 in [the issue log](../../../../docs/CODE_ISSUES.md).

## Policy and execution

[BasicDesktopPolicyEngine](../policy/engine.py) first checks the runtime shape. It allows focus/close/shell-patch/config-patch; gates `open_app` by `allowed_app_components` (HTTP composition uses `EWA_DESKTOP_ORCH_APP_ALLOWLIST`); and requires role name `orchestration_deep_link` for navigation. Profile memory or model output cannot override that verdict.

The [HTTP shell adapter](../adapters/eliteew_desktop_http.py) implements only `patch_shell_state` and `patch_desktop_config`. Other kinds return `ok: false` with `unsupported_intent_for_shell_state_http`. The fake driver used by default is not proof of real window manipulation. Companion chat window actions use a separate client action channel; see [driver/action catalog](EWA-APP-DRIVER-CATALOG.md).

## Example and typed helper limitation

```json
{"intent_kind":"patch_desktop_config","patch":{"theme":"dark","compact_widgets":true}}
```

This mapping passes structural/policy checks and is normalized again by the HTTP adapter. [desktop_intent_to_wire](../io/desktop_payload.py) currently omits the declared `PatchDesktopConfigIntent` dataclass and raises `TypeError` for that typed input (DOC-CODE-007). Mapping-based callers are not affected by that serializer omission.

Changes to an incompatible wire format need explicit consumer/schema versioning. There is no implemented v2 intent schema in this catalog.

Related: [observations](OBSERVATION-CATALOG.md), [policy and model flow](POLICY-LLM-MATRIX.md), [HTTP orchestration](DESKTOP-ORCHESTRATION.md).
