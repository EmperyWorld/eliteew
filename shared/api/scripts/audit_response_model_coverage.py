# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Audit Core4 + DesktopAI FastAPI handlers for missing / bare-dict response_model (Wave B7).
# Invariants:
# - Fail-closed mode exits non-zero on violations outside the SSE/binary allowlist.
# - Static AST only — no Keycloak / DB import of routers.
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# - api/tests/test_b7_response_model_coverage.py
# ---
from __future__ import annotations

import argparse
import ast
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]

SCOPE_ROOTS = [
    API_ROOT / "routers" / "professional_worlds_admin.py",
    API_ROOT / "routers" / "professional_worlds.py",
    API_ROOT / "routers" / "professional_worlds_ai_streams.py",
    API_ROOT / "routers" / "music_forge_admin.py",
    API_ROOT / "routers" / "music_forge.py",
    API_ROOT / "routers" / "marketing_cabinet",
    API_ROOT / "ewa_platform" / "gateways" / "routers",
    API_ROOT / "routers" / "desktop_ai_chat.py",
    # Wave B8 adjacent
    API_ROOT / "routers" / "themes.py",
    API_ROOT / "routers" / "companies.py",
    API_ROOT / "routers" / "voice_center_transcription.py",
]

# Paths (suffix after mount) or function names allowed without JSON response_model.
DEFAULT_ALLOWLIST: dict[str, list[str]] = {
    # StreamingResponse / FileResponse / 204 — documented SSE or binary
    "by_function": [
        "stream_companion_chat_task_events",
        "stream_companion_chat_task_run_events",
        "post_companion_chat_stream",
        "get_desktop_orchestration_session_events",
        "stream_music_forge_run_events",
        "stream_desktop_ai_chat",  # if present
        "post_desktop_chat_stream",
        "stream_desktop_chat_message",
    ],
}


@dataclass(frozen=True)
class Finding:
    path: str
    lineno: int
    function: str
    kind: str  # missing | bare_dict
    detail: str


def _iter_scope_files() -> list[Path]:
    out: list[Path] = []
    for root in SCOPE_ROOTS:
        if root.is_dir():
            out.extend(sorted(p for p in root.rglob("*.py") if p.name != "__init__.py"))
        elif root.is_file():
            out.append(root)
    return out


def _decorator_is_route(dec: ast.AST, src: str) -> bool:
    text = ast.get_source_segment(src, dec) or ""
    return any(
        tok in text
        for tok in (
            ".get(",
            ".post(",
            ".put(",
            ".patch(",
            ".delete(",
            ".api_route(",
            "add_api_route(",
        )
    )


def _response_model_expr(dec: ast.AST, src: str) -> str | None:
    if not isinstance(dec, ast.Call):
        return None
    for kw in dec.keywords:
        if kw.arg == "response_model":
            return (ast.get_source_segment(src, kw.value) or "").strip()
    return None


def _status_code_is_204(dec: ast.AST, src: str) -> bool:
    if not isinstance(dec, ast.Call):
        return False
    for kw in dec.keywords:
        if kw.arg != "status_code":
            continue
        if isinstance(kw.value, ast.Constant) and kw.value.value == 204:
            return True
        frag = (ast.get_source_segment(src, kw.value) or "").replace(" ", "")
        if "HTTP_204" in frag or frag.endswith("204"):
            return True
    return False


def _has_non_json_response_class(dec: ast.AST, src: str) -> bool:
    if not isinstance(dec, ast.Call):
        return False
    for kw in dec.keywords:
        if kw.arg != "response_class":
            continue
        frag = ast.get_source_segment(src, kw.value) or ""
        return any(
            m in frag for m in ("StreamingResponse", "FileResponse", "HTMLResponse", "PlainTextResponse", "Response")
        )
    return False


def _return_annotation(src: str, node: ast.AsyncFunctionDef | ast.FunctionDef) -> str:
    if node.returns is None:
        return ""
    return (ast.get_source_segment(src, node.returns) or "").strip()


def _is_non_json_return(ann: str) -> bool:
    markers = (
        "StreamingResponse",
        "FileResponse",
        "Response",
        "HTMLResponse",
        "PlainTextResponse",
    )
    return any(m in ann for m in markers)


def _is_bare_dict_model(expr: str) -> bool:
    cleaned = expr.replace(" ", "")
    return cleaned in {
        "dict",
        "dict[str,Any]",
        "Dict[str,Any]",
        "dict[str,Any]|None",
        "Optional[dict[str,Any]]",
    } or cleaned.startswith("dict[str,Any]")


def scan_file(path: Path, allow_functions: set[str]) -> list[Finding]:
    src = path.read_text(encoding="utf-8")
    tree = ast.parse(src)
    rel = str(path.relative_to(API_ROOT))
    findings: list[Finding] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        route_decs = [d for d in node.decorator_list if _decorator_is_route(d, src)]
        if not route_decs:
            continue
        if node.name in allow_functions:
            continue
        ann = _return_annotation(src, node)
        if _is_non_json_return(ann):
            continue
        if any(_status_code_is_204(d, src) for d in route_decs):
            continue
        if any(_has_non_json_response_class(d, src) for d in route_decs):
            continue
        # Unannotated file/HTML handlers that return FileResponse/StreamingResponse in body
        body_src = ast.get_source_segment(src, node) or ""
        if ("FileResponse" in body_src or "StreamingResponse" in body_src) and (
            ann in {"", "None"} or _is_non_json_return(ann)
        ):
            continue

        rm: str | None = None
        for d in route_decs:
            rm = _response_model_expr(d, src)
            if rm is not None:
                break

        if rm is None:
            findings.append(
                Finding(
                    path=rel,
                    lineno=node.lineno,
                    function=node.name,
                    kind="missing",
                    detail=f"return={ann or '<none>'}",
                )
            )
        elif _is_bare_dict_model(rm):
            findings.append(
                Finding(
                    path=rel,
                    lineno=node.lineno,
                    function=node.name,
                    kind="bare_dict",
                    detail=f"response_model={rm}",
                )
            )
    return findings


def scan_all(*, allow_functions: set[str] | None = None) -> list[Finding]:
    allow = allow_functions or set(DEFAULT_ALLOWLIST["by_function"])
    out: list[Finding] = []
    for path in _iter_scope_files():
        out.extend(scan_file(path, allow))
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fail-closed",
        action="store_true",
        help="Exit 1 when missing/bare-dict response_model findings remain",
    )
    parser.add_argument("--json", action="store_true", help="Print findings as JSON")
    args = parser.parse_args(argv)

    findings = scan_all()
    if args.json:
        print(json.dumps([asdict(f) for f in findings], indent=2, ensure_ascii=False))
    else:
        print(f"response_model coverage findings: {len(findings)}")
        for f in findings[:80]:
            print(f"  [{f.kind}] {f.path}:{f.lineno} {f.function} — {f.detail}")
        if len(findings) > 80:
            print(f"  … {len(findings) - 80} more")

    if args.fail_closed and findings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
