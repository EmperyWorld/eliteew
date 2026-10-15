#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Field-level OpenAPI schema-depth audit — bare/empty object bags on components
# and JSON response schemas (Wave B9a). CLI warn-by-default; --fail-closed for CI.
# Invariants:
# - Does not rewrite OpenAPI; reports findings only.
# - Critical component names are an explicit allowlist (pytest + CLI --critical).
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md §B9
# - shared/api/tests/test_b9_openapi_schema_depth.py
# ---
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Critical named schemas from Core4 / B-wave OpenAPI locks (B9a gate surface).
# Names must match REQUIRED_COMPONENTS in test_*_openapi.py (B1–B8).
DEFAULT_CRITICAL_COMPONENTS: frozenset[str] = frozenset(
    {
        # Desktop AI chat
        "DesktopAiChatOut",
        "DesktopAiChatListOut",
        "DesktopAiChatCapabilitiesOut",
        "DesktopAiMessageListOut",
        "DesktopAiMemoryCellOut",
        "DesktopAiChatMemberOut",
        "DesktopAiSoloSlotTariffsOut",
        "StreamBody",
        "ChatCreateBody",
        # EWA B4 companion / driver-catalog
        "CompanionContextAnchorGetOut",
        "CompanionContextAnchorRefreshOut",
        "CompanionContextDiagnoseOut",
        "CompanionOkOut",
        "CompanionDeletedOut",
        "EwaDriverCatalogEntryOut",
        "CompanionProfileOut",
        # Music Forge admin mutators
        "MusicForgeAdminLaneOut",
        "MusicForgeAdminPromptOut",
        "MusicForgeAdminStyleOut",
        "MusicForgeAdminModeOut",
        "MusicForgeAdminStageOut",
        "MusicForgeAdminStageDeleteOut",
        # Marketing client interaction
        "ClientInteractionContextOut",
        "ClientChatBridgeOut",
        "MarketingClientPartnerOut",
        "CustomerFacingSummaryGetOut",
        "CustomerFacingSummaryRecordOut",
        "CustomerFacingSummaryPayloadOut",
        "MarketingClientDocApprovalOut",
        "MarketingClientDocPendingRemovalOut",
        "ClientEwrpJobListItemOut",
        "ClientPresShareOut",
        "MarketingOkOut",
        # Professional Worlds admin
        "ProfessionalPackImportJobOut",
        "ProfessionalPackImportJobCreateOut",
        "ProfessionalPackImportConfirmOut",
        "ProfessionalPackReleaseOut",
        "ProfessionalVerticalRolloutOut",
        "ProfessionalVerticalRolloutMutateOut",
        "ProfessionalAiActionTestOut",
        "ProfessionalPhotoPresetTestOut",
        "ProfessionalVerticalPackExportOut",
        # Themes / company / voice (B8)
        "ThemePresetsOut",
        "ThemeActiveOut",
        "ThemeCreateOut",
        "ThemeMutationOut",
        "ThemeDeleteOut",
        "ThemeStatsOut",
        "CompanyStatsOut",
        "CompanyDeleteOut",
        "VoiceCenterTranscriptionHistoryItemOut",
        "VoiceCenterTranscriptionDetailOut",
        "VoiceCenterTranscriptionMetricsOut",
    }
)


# B9b complete — inventory empty; new nested bare bags fail pytest (see test_b9_openapi_schema_depth).
DEFAULT_KNOWN_NESTED_BAGS: frozenset[tuple[str, str]] = frozenset()


def regression_findings(
    findings: list[SchemaDepthFinding],
    *,
    known: frozenset[tuple[str, str]] = DEFAULT_KNOWN_NESTED_BAGS,
) -> list[SchemaDepthFinding]:
    """Findings not in the B9a known-nested inventory (new depth regressions)."""
    return [f for f in findings if (f.component, f.path) not in known]


def top_level_bare_findings(findings: list[SchemaDepthFinding]) -> list[SchemaDepthFinding]:
    """Entire component schema is an unconstrained object (path empty or '$')."""
    return [f for f in findings if f.path in {"", "$"} and f.kind == "bare_object_bag"]


@dataclass(frozen=True)
class SchemaDepthFinding:
    component: str
    path: str
    kind: str
    detail: str


def _is_bare_object_bag(schema: dict[str, Any]) -> bool:
    """True when schema is an unconstrained JSON object (FE `Record` / `object`)."""
    if not isinstance(schema, dict):
        return False
    if schema.get("$ref"):
        return False
    if schema.get("properties") or schema.get("items") or schema.get("anyOf") or schema.get("oneOf"):
        return False
    if schema.get("type") == "object" and schema.get("additionalProperties") is True:
        return True
    # Empty object or type:object without properties — still opaque to FE codegen.
    if (
        (schema == {} or (schema.get("type") == "object" and "additionalProperties" not in schema))
        and not schema.get("properties")
        and not schema.get("$ref")
    ):
        return schema.get("type") == "object" or schema == {}
    return False


def _walk_schema(
    schema: dict[str, Any],
    *,
    component: str,
    path: str,
    findings: list[SchemaDepthFinding],
    max_depth: int,
    depth: int = 0,
) -> None:
    if depth > max_depth or not isinstance(schema, dict):
        return
    if _is_bare_object_bag(schema):
        findings.append(
            SchemaDepthFinding(
                component=component,
                path=path or "$",
                kind="bare_object_bag",
                detail=json.dumps(schema, sort_keys=True)[:200],
            )
        )
        return
    props = schema.get("properties")
    if isinstance(props, dict):
        for name, child in props.items():
            if isinstance(child, dict):
                child_path = f"{path}.{name}" if path else name
                if _is_bare_object_bag(child):
                    findings.append(
                        SchemaDepthFinding(
                            component=component,
                            path=child_path,
                            kind="nested_bare_object",
                            detail=json.dumps(child, sort_keys=True)[:200],
                        )
                    )
                else:
                    _walk_schema(
                        child,
                        component=component,
                        path=child_path,
                        findings=findings,
                        max_depth=max_depth,
                        depth=depth + 1,
                    )
    items = schema.get("items")
    if isinstance(items, dict):
        _walk_schema(
            items,
            component=component,
            path=f"{path}[]" if path else "[]",
            findings=findings,
            max_depth=max_depth,
            depth=depth + 1,
        )
    for key in ("anyOf", "oneOf", "allOf"):
        variants = schema.get(key)
        if isinstance(variants, list):
            for i, variant in enumerate(variants):
                if isinstance(variant, dict):
                    _walk_schema(
                        variant,
                        component=component,
                        path=f"{path}.{key}[{i}]" if path else f"{key}[{i}]",
                        findings=findings,
                        max_depth=max_depth,
                        depth=depth + 1,
                    )


def audit_components(
    openapi: dict[str, Any],
    *,
    critical_only: frozenset[str] | None = None,
    max_depth: int = 6,
) -> list[SchemaDepthFinding]:
    schemas = (openapi.get("components") or {}).get("schemas") or {}
    if not isinstance(schemas, dict):
        return []
    names = sorted(schemas.keys())
    if critical_only is not None:
        names = [n for n in names if n in critical_only]
    findings: list[SchemaDepthFinding] = []
    for name in names:
        schema = schemas[name]
        if not isinstance(schema, dict):
            continue
        _walk_schema(
            schema,
            component=name,
            path="",
            findings=findings,
            max_depth=max_depth,
        )
    return findings


def load_openapi_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        msg = f"OpenAPI root must be object: {path}"
        raise ValueError(msg)
    return data


def build_default_openapi() -> dict[str, Any]:
    """Assemble a minimal FastAPI app covering B-wave critical routers."""
    from api.ewa_platform.gateways.routers.companion_profile import router as companion_profile_router
    from api.ewa_platform.gateways.routers.companion_user_workflows import (
        router as companion_user_workflows_router,
    )
    from api.ewa_platform.gateways.routers.standalone_facade import router as standalone_facade_router
    from api.routers.companies import router as companies_router
    from api.routers.desktop_ai_chat import router as desktop_ai_chat_router
    from api.routers.marketing_cabinet.client_interaction import (
        router as client_interaction_router,
    )
    from api.routers.music_forge_admin import router as music_forge_admin_router
    from api.routers.professional_worlds_admin import router as professional_worlds_admin_router
    from api.routers.themes import router as themes_router
    from api.routers.voice_center_transcription import router as voice_center_transcription_router
    from fastapi import FastAPI  # type: ignore[import-untyped]

    app = FastAPI()
    app.include_router(desktop_ai_chat_router, prefix="/api/v1")
    app.include_router(companion_profile_router, prefix="/api/v1/ewa")
    app.include_router(companion_user_workflows_router, prefix="/api/v1/ewa")
    app.include_router(standalone_facade_router, prefix="/api/v1/ewa")
    app.include_router(music_forge_admin_router, prefix="/api/v1")
    app.include_router(client_interaction_router)
    app.include_router(professional_worlds_admin_router, prefix="/api/v1")
    app.include_router(themes_router)
    app.include_router(companies_router, prefix="/api/v1")
    app.include_router(voice_center_transcription_router)
    return app.openapi()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit OpenAPI schema field depth (bare object bags).")
    parser.add_argument(
        "--openapi",
        type=Path,
        default=None,
        help="Path to openapi.json (default: build from critical routers)",
    )
    parser.add_argument(
        "--critical-only",
        action="store_true",
        help="Scan only DEFAULT_CRITICAL_COMPONENTS present in the spec",
    )
    parser.add_argument(
        "--fail-closed",
        action="store_true",
        help="Exit 1 when any finding is reported (full zero-bag gate)",
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit 1 on findings outside DEFAULT_KNOWN_NESTED_BAGS or top-level bare components",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=6,
        help="Max nested property walk depth (default 6)",
    )
    args = parser.parse_args(argv)

    openapi = load_openapi_json(args.openapi) if args.openapi else build_default_openapi()
    critical = DEFAULT_CRITICAL_COMPONENTS if args.critical_only else None
    findings = audit_components(openapi, critical_only=critical, max_depth=args.max_depth)

    if not findings:
        print("OK: no bare/empty object bags in scanned components")
        return 0

    print(f"Found {len(findings)} schema-depth issue(s):")
    for f in findings:
        print(f"  [{f.kind}] {f.component}.{f.path}: {f.detail}")

    top = top_level_bare_findings(findings)
    regressions = regression_findings(findings)
    if top:
        print(f"Top-level bare components: {len(top)}")
    if regressions:
        print(f"Regressions (not in known inventory): {len(regressions)}")
        for f in regressions:
            print(f"  NEW [{f.kind}] {f.component}.{f.path}")

    if args.fail_closed:
        return 1
    if args.fail_on_regression:
        if top or regressions:
            return 1
        print("OK: no top-level bare components and no nested-bag regressions")
        return 0
    print("(warn-only; pass --fail-on-regression or --fail-closed to fail CI)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
