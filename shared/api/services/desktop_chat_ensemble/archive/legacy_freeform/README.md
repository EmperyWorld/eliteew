# Legacy freeform ensemble (archived code path)

Текущий стек **до** режима `blueprint`: JSON-оркестратор (`plan_ensemble_speakers`), `joint`/`separate`, опциональный chair, `joint_polish`, последовательный SSE по спикерам.

- **Вызов:** только через диспетчер [`stream_ensemble_turn`](../../stream_turn.py) при явном `desktop_ensemble_engine: legacy_freeform` в настройках чата или в admin defaults (см. `resolve_ensemble_engine` в `settings.py`; иначе по умолчанию — `blueprint`).
- **Не импортировать** из продакшен-кода напрямую, кроме диспетчера — так проще отрезать путь при удалении.
- Модули: `orchestrator.py`, `stream_turn.py`, `chair.py`, `joint_polish.py`.
