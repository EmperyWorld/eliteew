# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIS static guard regression — proves AIS-SIO-02 catches data.get() type erosion.
# Invariants:
# - Does not modify production socketio_handler.py on disk.
# Related:
# - tests/architecture/static_guard.py
# ---

from __future__ import annotations

from tests.architecture.static_guard import format_violations, scan_socketio_handler_source


def test_ais_static_guard_passes_on_canonical_handler(socketio_handler_source: str) -> None:
    violations = scan_socketio_handler_source(source=socketio_handler_source)
    assert violations == [], format_violations(violations)


def test_ais_regression_trap_catches_data_get_antipattern() -> None:
    corrupted = """
@sio.event
async def cursor_move(sid, data) -> None:
    line = data.get("cursor_position", {}).get("line")
    column = data.get("cursor_position", {}).get("column")
    await sio.emit("cursor_update", {"line": line, "column": column}, room=sid)
"""
    violations = scan_socketio_handler_source(source=corrupted, path="corrupted_socketio_handler.py")
    rule_ids = {v.rule_id for v in violations}
    assert "AIS-SIO-02" in rule_ids
    assert any("data.get()" in v.message for v in violations)


def test_ais_regression_trap_catches_missing_parse_socket_event() -> None:
    corrupted = """
@sio.event
async def join_document(sid, data) -> None:
    document_id = data["document_id"]
    await sio.enter_room(sid, f"doc_editor_{document_id}")
"""
    violations = scan_socketio_handler_source(source=corrupted, path="corrupted_socketio_handler.py")
    rule_ids = {v.rule_id for v in violations}
    assert "AIS-SIO-01" in rule_ids
    assert "AIS-SIO-02" in rule_ids
