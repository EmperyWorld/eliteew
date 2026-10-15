# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave B9a lock — OpenAPI field-depth audit on Core4/B-wave critical components.
# Invariants:
# - All DEFAULT_CRITICAL_COMPONENTS present in assembled OpenAPI.
# - No top-level bare object components; nested bare bags inventory empty post-B9b.
# Related:
# - api/scripts/audit_openapi_schema_depth.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md §B9
# ---
from __future__ import annotations

from typing import Any

from api.scripts.audit_openapi_schema_depth import (
    DEFAULT_CRITICAL_COMPONENTS,
    DEFAULT_KNOWN_NESTED_BAGS,
    audit_components,
    build_default_openapi,
    regression_findings,
    top_level_bare_findings,
)


def test_audit_detects_synthetic_bare_bag() -> None:
    openapi: dict[str, Any] = {
        "components": {
            "schemas": {
                "GoodOut": {
                    "type": "object",
                    "properties": {"ok": {"type": "boolean"}},
                },
                "BagOut": {"type": "object", "additionalProperties": True},
                "NestedBagOut": {
                    "type": "object",
                    "properties": {
                        "meta": {"type": "object", "additionalProperties": True},
                    },
                },
            }
        }
    }
    findings = audit_components(openapi)
    paths = {(f.component, f.path) for f in findings}
    assert ("BagOut", "$") in paths
    assert ("NestedBagOut", "meta") in paths
    assert not any(f.component == "GoodOut" for f in findings)


def test_b9_critical_components_present_and_no_depth_regression() -> None:
    spec = build_default_openapi()
    schemas = (spec.get("components") or {}).get("schemas") or {}
    missing = sorted(DEFAULT_CRITICAL_COMPONENTS - set(schemas))
    assert not missing, f"critical OpenAPI components missing: {missing}"

    findings = audit_components(spec, critical_only=DEFAULT_CRITICAL_COMPONENTS)
    top = top_level_bare_findings(findings)
    assert not top, f"top-level bare components: {top}"

    regressions = regression_findings(findings, known=DEFAULT_KNOWN_NESTED_BAGS)
    assert not regressions, "new nested bare bags (update B9b or DEFAULT_KNOWN_NESTED_BAGS): " + ", ".join(
        f"{f.component}.{f.path}" for f in regressions
    )
