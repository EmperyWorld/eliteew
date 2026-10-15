# Python 3.14+ Backend Baseline

The EliteEW API backend assumes **Python 3.14** and uses features that require this version.

## Enforced at startup

- `api/main.py` defines `EXPECTED_PYTHON_MAJOR = 3` and `EXPECTED_PYTHON_MINOR = 14`.
- `check_critical_versions()` runs at startup and logs a warning on version mismatch.

## Features in use

- **Typing**: Built-in generics (`list[...]`, `dict[...]`) and union syntax (`X | None`, `A | B`). No `typing.List`/`Optional`/`Union` for new code.
- **Asyncio**: `asyncio.TaskGroup` for structured concurrency; `asyncio.timeout()` for time-bounded operations (replacing `asyncio.wait_for` where appropriate).
- **Pattern matching**: `match`/`case` for task_type and provider dispatch (e.g. `ai_service_orchestrator`, DAG generator template).
- **Stdlib**: `compression.zstd` used when available (e.g. cache compression); fallback to gzip via import availability, no `sys.version_info` guards.

Contributors should develop and run the API with Python 3.14.

## Follow-up opportunities (Python 3.12+)

Optional improvements to consider after the core modernization:

- **Exception groups**: Use `except*` for handling multiple exceptions from TaskGroup or `gather(..., return_exceptions=True)` where a single handler per type is clearer.
- **Context managers**: Adopt `contextlib.chained()` or other 3.12+ context utilities where multiple resources are used together.
- **TypeForm**: Use `typing.TypeForm` (3.12+) where type-of-type annotations improve clarity.
- **f-string debugging**: Use `={var}` in f-strings for quick debug output where appropriate.
- **Override decorator**: Use `@override` for methods that intentionally override base class behavior (requires typing_extensions or 3.12+).
