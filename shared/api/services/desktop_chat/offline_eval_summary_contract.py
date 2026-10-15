# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build and validate aggregated JSON summary for Desktop AI Chat offline eval.
# Invariants:
# - Single owner for AI_CHAT_EVAL_JSON_SUMMARY=1 output shape.
# Related:
# - docker/scripts/desktop-ai-chat-offline-eval.sh
# - api/tests/fixtures/desktop_chat_offline_eval_summary_golden.json
# ---

"""Offline eval aggregated JSON summary contract for Desktop AI Chat."""

from __future__ import annotations

from typing import Any

PRODUCT_ID = "desktop_ai_chat"
EVAL_KIND = "offline"


def build_offline_eval_summary(
    *,
    frontend_status: str,
    assert_json: dict[str, Any] | None,
    ops_manifest_json: dict[str, Any] | None,
    skip_assert_cli: bool,
    skip_ops_manifest: bool,
) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "product": PRODUCT_ID,
        "eval": EVAL_KIND,
        "status": "ok",
        "backend_pytest": "ok",
        "frontend_vitest": frontend_status,
    }
    if skip_assert_cli:
        summary["assert_cli"] = "skipped"
    elif assert_json is not None:
        summary["assert_cli"] = assert_json
    if skip_ops_manifest:
        summary["ops_manifest"] = "skipped"
    elif ops_manifest_json is not None:
        summary["ops_manifest"] = ops_manifest_json
    return summary


def validate_offline_eval_summary(data: dict[str, Any]) -> None:
    if data.get("product") != PRODUCT_ID:
        raise ValueError(f"offline eval summary product={data.get('product')!r}")
    if data.get("eval") != EVAL_KIND:
        raise ValueError(f"offline eval summary eval={data.get('eval')!r}")
    if data.get("status") != "ok":
        raise ValueError(f"offline eval summary status={data.get('status')!r}")
    if data.get("backend_pytest") != "ok":
        raise ValueError(f"offline eval summary backend_pytest={data.get('backend_pytest')!r}")

    frontend_vitest = data.get("frontend_vitest")
    if frontend_vitest not in {"ok", "skipped"}:
        raise ValueError(f"offline eval summary frontend_vitest={frontend_vitest!r}")

    assert_cli = data.get("assert_cli")
    if assert_cli == "skipped":
        pass
    elif isinstance(assert_cli, dict):
        if "case" not in assert_cli:
            raise ValueError("offline eval summary assert_cli missing case")
    else:
        raise ValueError("offline eval summary assert_cli missing or invalid")

    ops_manifest = data.get("ops_manifest")
    if ops_manifest == "skipped":
        return
    if not isinstance(ops_manifest, dict):
        raise ValueError("offline eval summary ops_manifest missing or invalid")
    if ops_manifest.get("ops_manifest") != "ok":
        raise ValueError(f"offline eval summary ops_manifest status={ops_manifest.get('ops_manifest')!r}")
    gate_count = ops_manifest.get("gate_count")
    if not isinstance(gate_count, int) or gate_count < 1:
        raise ValueError(f"offline eval summary ops_manifest gate_count={gate_count!r}")
