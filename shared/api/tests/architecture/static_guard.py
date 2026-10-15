# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AST static guard for Socket.IO inbound handler architectural invariants (AIS-SIO-*).
# Invariants:
# - Read-only analysis; no source mutation.
# Related:
# - tests/architecture/RULES.md
# - api/routers/socketio_handler.py
# ---

from __future__ import annotations

import ast
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

SOCKETIO_HANDLER_REL = Path("api/routers/socketio_handler.py")

INBOUND_HANDLER_ALLOWLIST = frozenset({"connect", "disconnect", "test_event"})

INBOUND_HANDLERS_REQUIRING_PARSE = frozenset(
    {
        "emperyworld_client_heartbeat",
        "ping",
        "message",
        "chat_message",
        "subscribe",
        "unsubscribe",
        "join_document",
        "leave_document",
        "kick_document_user",
        "cursor_move",
        "get_collaborators",
        "join_collaboration_session",
        "leave_collaboration_session",
        "collaboration_change",
    }
)


@dataclass(frozen=True, slots=True)
class AisViolation:
    rule_id: str
    path: str
    line: int
    message: str

    def format(self) -> str:
        return f"{self.rule_id} {self.path}:{self.line} — {self.message}"


class _SocketIoInboundVisitor(ast.NodeVisitor):
    def __init__(self, *, path: str, source: str) -> None:
        self.path = path
        self.source = source
        self.violations: list[AisViolation] = []
        self._current_handler: str | None = None
        self._handler_has_data_param = False
        self._uses_parse_socket_event = False

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        if not _is_sio_event_handler(node):
            self.generic_visit(node)
            return

        self._current_handler = node.name
        self._handler_has_data_param = _has_param(node, "data")
        self._uses_parse_socket_event = False

        if node.name in INBOUND_HANDLER_ALLOWLIST:
            self.generic_visit(node)
            self._current_handler = None
            return

        if node.name in INBOUND_HANDLERS_REQUIRING_PARSE and self._handler_has_data_param:
            self.generic_visit(node)
            if not self._uses_parse_socket_event:
                self.violations.append(
                    AisViolation(
                        rule_id="AIS-SIO-01",
                        path=self.path,
                        line=node.lineno,
                        message=(f"handler `{node.name}` must call parse_socket_event before reading inbound payload"),
                    )
                )
        else:
            self.generic_visit(node)

        self._current_handler = None

    def visit_Call(self, node: ast.Call) -> None:
        if self._current_handler and _is_parse_socket_event_call(node):
            self._uses_parse_socket_event = True
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if (
            self._current_handler
            and self._handler_has_data_param
            and node.attr == "get"
            and isinstance(node.value, ast.Name)
            and node.value.id == "data"
        ):
            self.violations.append(
                AisViolation(
                    rule_id="AIS-SIO-02",
                    path=self.path,
                    line=node.lineno,
                    message=f"handler `{self._current_handler}` uses data.get() — use Pydantic model attributes",
                )
            )
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        if (
            self._current_handler
            and self._handler_has_data_param
            and isinstance(node.value, ast.Name)
            and node.value.id == "data"
        ):
            self.violations.append(
                AisViolation(
                    rule_id="AIS-SIO-02",
                    path=self.path,
                    line=node.lineno,
                    message=(
                        f"handler `{self._current_handler}` uses data[...] subscript — "
                        "use parse_socket_event + model attributes"
                    ),
                )
            )
        self.generic_visit(node)


def _is_sio_event_handler(node: ast.AsyncFunctionDef) -> bool:
    for decorator in node.decorator_list:
        if isinstance(decorator, ast.Attribute):
            if isinstance(decorator.value, ast.Name) and decorator.value.id == "sio":
                return decorator.attr == "event"
        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
            if isinstance(decorator.func.value, ast.Name) and decorator.func.value.id == "sio":
                return decorator.func.attr == "event"
    return False


def _has_param(node: ast.AsyncFunctionDef, name: str) -> bool:
    return any(arg.arg == name for arg in node.args.args)


def _is_parse_socket_event_call(node: ast.Call) -> bool:
    func = node.func
    if isinstance(func, ast.Name) and func.id == "parse_socket_event":
        return True
    return isinstance(func, ast.Attribute) and func.attr == "parse_socket_event"


def scan_socketio_handler_source(*, source: str, path: str = str(SOCKETIO_HANDLER_REL)) -> list[AisViolation]:
    tree = ast.parse(source, filename=path)
    visitor = _SocketIoInboundVisitor(path=path, source=source)
    visitor.visit(tree)
    return visitor.violations


def scan_socketio_handler_file(handler_path: Path) -> list[AisViolation]:
    source = handler_path.read_text(encoding="utf-8")
    rel = (
        str(handler_path.as_posix().split("shared/api/")[-1])
        if "shared/api/" in handler_path.as_posix()
        else str(handler_path)
    )
    return scan_socketio_handler_source(source=source, path=rel)


def format_violations(violations: Iterable[AisViolation]) -> str:
    return "\n".join(v.format() for v in violations)


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="AIS static guard for Socket.IO inbound handlers")
    parser.add_argument(
        "--handler",
        type=Path,
        default=None,
        help="Path to socketio_handler.py (default: shared/api/routers/socketio_handler.py)",
    )
    args = parser.parse_args(argv)

    api_root = Path(__file__).resolve().parents[2]
    handler_path = args.handler or (api_root / "routers" / "socketio_handler.py")
    if not handler_path.is_file():
        print(f"ERROR: handler not found: {handler_path}", file=sys.stderr)
        return 2

    violations = scan_socketio_handler_file(handler_path)
    if violations:
        print("AIS static guard FAILED:")
        print(format_violations(violations))
        return 1

    print("AIS static guard PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
