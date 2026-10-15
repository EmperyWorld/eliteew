# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for Professional Worlds admin weak outs (Wave B3).
# Invariants:
# - Pack import/release/rollout/test/inspect/export JSON must $ref named schemas.
# Related:
# - api/schemas/professional_worlds.py
# - api/routers/professional_worlds_admin.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.professional_worlds_admin import router as pw_admin_router

PREFIX = "/api/v1/professional-worlds/admin"

JSON_CONTRACTS: list[tuple[str, str, str]] = [
    ("post", "/ai-actions/{action_key}/test", "ProfessionalAiActionTestOut"),
    ("post", "/photo-presets/{preset_key}/test", "ProfessionalPhotoPresetTestOut"),
    ("get", "/verticals/{slug}/export", "ProfessionalVerticalPackExportOut"),
    ("post", "/packs/import/jobs", "ProfessionalPackImportJobCreateOut"),
    ("get", "/packs/import/jobs/{job_id}", "ProfessionalPackImportJobOut"),
    ("post", "/packs/import/jobs/{job_id}/confirm", "ProfessionalPackImportConfirmOut"),
    ("post", "/packs/{vertical_slug}/releases", "ProfessionalPackReleaseOut"),
    ("post", "/packs/releases/{release_id}/approve", "ProfessionalPackReleaseOut"),
    ("post", "/packs/releases/{release_id}/publish", "ProfessionalPackReleaseOut"),
    ("post", "/packs/releases/{release_id}/rollback", "ProfessionalPackReleaseOut"),
    ("get", "/rollouts", "ProfessionalVerticalRolloutOut"),
    ("post", "/rollouts", "ProfessionalVerticalRolloutMutateOut"),
    ("patch", "/rollouts/{rollout_id}", "ProfessionalVerticalRolloutMutateOut"),
    ("post", "/rollouts/{rollout_id}/pause", "ProfessionalVerticalRolloutMutateOut"),
    ("post", "/rollouts/{rollout_id}/resume", "ProfessionalVerticalRolloutMutateOut"),
    (
        "get",
        "/ai-actions/{vertical_slug}/{action_key}/prompt-inspect",
        "ProfessionalAiActionPromptInspectOut",
    ),
    (
        "get",
        "/photo-presets/{vertical_slug}/{preset_key}/prompt-inspect",
        "ProfessionalPhotoPresetPromptInspectOut",
    ),
]

REQUIRED_COMPONENTS = [
    "ProfessionalPackImportJobOut",
    "ProfessionalPackImportJobCreateOut",
    "ProfessionalPackImportConfirmOut",
    "ProfessionalPackManifestSnapshotBody",
    "ProfessionalPackReleaseOut",
    "ProfessionalVerticalRolloutOut",
    "ProfessionalVerticalRolloutMutateOut",
    "ProfessionalAiActionTestOut",
    "ProfessionalPhotoPresetTestOut",
    "ProfessionalVerticalPackExportOut",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    # Router already carries prefix `/professional-worlds/admin`.
    app.include_router(pw_admin_router, prefix="/api/v1")
    return app.openapi()


def _response_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    responses = op["responses"]
    for code in ("200", "201"):
        if code in responses and "content" in responses[code]:
            content = responses[code]["content"]
            if "application/json" in content:
                return content["application/json"]["schema"]
    raise AssertionError(f"no JSON 200/201 for {method}: {list(responses)}")


def _assert_ref(schema: dict[str, Any], expected_name: str) -> None:
    ref = schema.get("$ref")
    if ref == f"#/components/schemas/{expected_name}":
        return
    if schema.get("type") == "array":
        items = schema.get("items") or {}
        if items.get("$ref") == f"#/components/schemas/{expected_name}":
            return
        # FastAPI may wrap list response_model as anyOf / items
        any_of = schema.get("anyOf") or schema.get("oneOf") or []
        for branch in any_of:
            if isinstance(branch, dict) and branch.get("type") == "array":
                items = branch.get("items") or {}
                if items.get("$ref") == f"#/components/schemas/{expected_name}":
                    return
    raise AssertionError(f"expected $ref {expected_name}, got {schema!r}")


def test_pw_admin_openapi_exports_named_components() -> None:
    schemas = _openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_pw_admin_weak_json_paths_use_named_response_models() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, suffix, expected in JSON_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _response_schema(paths[full], method)
        _assert_ref(schema, expected)


def test_pw_admin_no_dict_response_model_on_b3_paths() -> None:
    """Regression: B3 paths must not remain additionalProperties-only objects."""
    doc = _openapi()
    for method, suffix, _expected in JSON_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        schema = _response_schema(doc["paths"][full], method)
        if schema.get("$ref"):
            continue
        if schema.get("type") == "array" and (schema.get("items") or {}).get("$ref"):
            continue
        # Bare free-form object is forbidden
        assert not (
            schema.get("type") == "object"
            and schema.get("additionalProperties") is True
            and not schema.get("properties")
        ), f"{full} still free-form object: {schema!r}"


REQUEST_BODY_CONTRACTS: list[tuple[str, str, str]] = [
    ("post", "/verticals/import/dry-run", "VerticalPackImportRequest"),
    ("post", "/packs/{vertical_slug}/diff", "ProfessionalPackManifestSnapshotBody"),
    ("post", "/packs/import/jobs", "ProfessionalPackManifestSnapshotBody"),
]


def _request_body_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    body = (op.get("requestBody") or {}).get("content") or {}
    if "application/json" not in body:
        raise AssertionError(f"no JSON request body for {method}")
    schema = body["application/json"]["schema"]
    if "$ref" in schema:
        return schema
    if schema.get("allOf"):
        for branch in schema["allOf"]:
            if isinstance(branch, dict) and branch.get("$ref"):
                return branch
    raise AssertionError(f"unexpected request body schema: {schema!r}")


def test_pw_admin_manifest_snapshot_request_bodies_are_named() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, suffix, expected in REQUEST_BODY_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _request_body_schema(paths[full], method)
        _assert_ref(schema, expected)
