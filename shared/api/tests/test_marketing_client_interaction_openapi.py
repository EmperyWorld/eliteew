# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for Marketing Cabinet client-interaction JSON outs (Wave B1).
# Invariants:
# - Critical JSON endpoints must $ref named schemas (not bare additionalProperties object).
# - Tests inspect OpenAPI only; no auth or DB I/O.
# Related:
# - api/schemas/marketing_cabinet/client_interaction.py
# - api/routers/marketing_cabinet/client_interaction.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.client_interaction import router as client_interaction_router

CI_PREFIX = "/api/v1/marketing-cabinet/client-interaction"

# method -> path suffix -> expected schema name (or list item $ref name)
JSON_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/context", "ClientInteractionContextOut"),
    ("get", "/chat-bridge", "ClientChatBridgeOut"),
    ("get", "/customer-facing-summary", "CustomerFacingSummaryGetOut"),
    ("put", "/customer-facing-summary", "MarketingOkOut"),
    ("get", "/documents", "MarketingClientDocApprovalOut"),
    ("post", "/documents", "MarketingClientDocCountOut"),
    ("post", "/documents/{approval_id}/approve", "MarketingClientApprovalActionOut"),
    ("post", "/documents/{approval_id}/request-removal", "MarketingClientRemovalIdOut"),
    ("post", "/removal-requests/{removal_id}/confirm", "MarketingOkOut"),
    ("post", "/removal-requests/{removal_id}/cancel", "MarketingOkOut"),
    ("get", "/ewrp-jobs", "ClientEwrpJobListItemOut"),
    ("post", "/presentations/share", "MarketingClientShareIdOut"),
    ("get", "/presentations", "ClientPresShareOut"),
    ("delete", "/presentations/{share_id}", "MarketingOkOut"),
]

REQUIRED_COMPONENTS = [
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
    "MarketingClientDocCountOut",
    "MarketingClientRemovalIdOut",
    "MarketingClientShareIdOut",
    "MarketingClientApprovalActionOut",
    "CustomerFacingSummaryBody",
    "SendDocumentsBody",
    "SharePresentationBody",
]


def _ci_openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(client_interaction_router, prefix="/api/v1/marketing-cabinet")
    return app.openapi()


def _response_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    responses = op["responses"]
    for code in ("200", "201"):
        if code in responses and "content" in responses[code]:
            content = responses[code]["content"]
            if "application/json" in content:
                return content["application/json"]["schema"]
    raise AssertionError(f"no JSON 200/201 response for {method}: {list(responses)}")


def _assert_ref_or_list_ref(schema: dict[str, Any], expected_name: str) -> None:
    ref = schema.get("$ref")
    if ref == f"#/components/schemas/{expected_name}":
        return
    if schema.get("type") == "array":
        items = schema.get("items") or {}
        if items.get("$ref") == f"#/components/schemas/{expected_name}":
            return
        # FastAPI may wrap list response_model under title without $ref on items
        # when using list[Model] — still require $ref on items.
    raise AssertionError(f"expected $ref {expected_name}, got {schema!r}")


def test_client_interaction_openapi_exports_named_components() -> None:
    schemas = _ci_openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_client_interaction_json_paths_use_named_response_models() -> None:
    doc = _ci_openapi()
    paths = doc["paths"]
    for method, suffix, expected in JSON_CONTRACTS:
        full = f"{CI_PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _response_schema(paths[full], method)
        _assert_ref_or_list_ref(schema, expected)


def test_client_interaction_partner_schema_matches_friends_lookup() -> None:
    schemas = _ci_openapi()["components"]["schemas"]
    partner = schemas["MarketingClientPartnerOut"]
    props = set(partner.get("properties", {}).keys())
    required = set(partner.get("required", []))
    assert "id" in required
    for key in (
        "username",
        "avatar_url",
        "full_name",
        "is_trusted",
        "admin_badge_label",
        "admin_badge_hint",
        "is_system_account",
    ):
        assert key in props
    # Friendship mute/block flags are not part of find_user_by_id
    assert "is_muted" not in props
    assert "is_blocked" not in props
