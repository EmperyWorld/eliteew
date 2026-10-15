# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for UGS Admin v2 validation, model route patch deletion, and bulk apply result shape.
# Invariants:
# - Non-text providers must not regain provider-level text model fields through bulk provider patches.
# - Scoped model route deletion uses `null`/blank patch values and must not require full replacement.
# Related:
# - api/services/ugs/admin_v2_service.py
# - api/schemas/ugs_admin.py
# ---

from __future__ import annotations

from api.schemas.ugs_admin import (
    UgsAdminV2ModelRoutes,
    UgsAdminV2SettingCreateOperation,
    UgsAdminV2SettingDeleteOperation,
    UgsAdminV2SettingPatchOperation,
    UGSSettingCreate,
    UGSSettingUpdate,
)
from api.services.ugs.admin_v2_dry_run import apply_ops_dry_run
from api.services.ugs.admin_v2_service import (
    _merge_model_routes,
    _model_routes_patch_result_entries,
    _setting_natural_key,
    _State,
    build_autofix_recommendations,
    validate_model_routes,
    validate_state,
)
from api.services.ugs.model_routing_service import UGSModelRoutingService


def test_merge_model_routes_deletes_scoped_route_with_null() -> None:
    current = UgsAdminV2ModelRoutes(
        provider_defaults={"llama": "provider-model"},
        category_defaults={"music": "music-model"},
        type_overrides={"music_generator_lyrics": "type-model"},
    )
    patch = UgsAdminV2ModelRoutes(
        provider_defaults={"llama": None},
        type_overrides={"music_generator_lyrics": ""},
    )

    merged = _merge_model_routes(current, patch)

    assert merged.provider_defaults == {}
    assert merged.category_defaults == {"music": "music-model"}
    assert merged.type_overrides == {}


def test_validate_state_warns_about_legacy_model_fields_on_non_text_provider() -> None:
    state = _State(
        providers=[
            {
                "provider_name": "stable_diffusion",
                "provider_type": "stable_diffusion",
                "base_url": "http://stack2-stable-diffusion:7860",
                "config_json": {"default_model": "qwen", "models": ["qwen"], "provider_role": "text"},
            }
        ],
        types=[],
        workflows=[],
    )

    issues = validate_state(state)

    assert any(issue.severity == "warning" and issue.field == "config_json" for issue in issues)
    assert any(issue.severity == "warning" and issue.field == "config_json.provider_role" for issue in issues)
    assert not any(issue.severity == "warning" and "default_model не входит" in issue.message for issue in issues)


def test_validate_state_rejects_embedding_model_on_text_provider() -> None:
    state = _State(
        providers=[
            {
                "provider_name": "imc_rag_research_provider",
                "provider_type": "miso",
                "base_url": "http://stack2-llama-chat:8080",
                "config_json": {
                    "default_model": "Qwen3-Embedding-4B-Q4_K_M.gguf",
                    "models": ["Qwen3-Embedding-4B-Q4_K_M.gguf"],
                    "provider_role": "text",
                },
            }
        ],
        types=[],
        workflows=[],
    )

    issues = validate_state(state)

    assert any(
        issue.severity == "error"
        and issue.entity_id == "imc_rag_research_provider"
        and issue.field == "config_json.models"
        for issue in issues
    )


def test_build_autofix_recommends_cleaning_non_text_provider_model_fields() -> None:
    providers = [
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "provider_name": "comfyui",
            "provider_type": "comfyui",
            "base_url": "http://stack2-comfyui:3000",
            "api_key_required": False,
            "health_endpoint": "/system_stats",
            "timeout_seconds": 300,
            "max_concurrent": 2,
            "enabled": True,
            "cost_per_request": 0,
            "fallback_priority": 0,
            "fallback_for": [],
            "config_json": {"default_model": "legacy", "models": ["legacy"], "provider_role": "text", "keep": True},
            "display_label": None,
        }
    ]

    from api.schemas.ugs_admin import GenerationProviderResponse

    recommendations = build_autofix_recommendations(
        providers=[GenerationProviderResponse.model_validate(item) for item in providers],
        types=[],
        workflows=[],
        model_routes=UgsAdminV2ModelRoutes(),
        model_inventory=[],
        resolved_models=[],
    )

    cleanup = next(item for item in recommendations if item.id == "clean-non-text-provider-model-fields")
    assert cleanup.affected_count == 1
    assert cleanup.operations == [
        {
            "kind": "provider.patch",
            "provider_names": ["comfyui"],
            "patch": {"config_json": {"keep": True}},
        }
    ]


def test_model_routes_patch_result_entries_counts_each_scoped_route() -> None:
    entries = _model_routes_patch_result_entries(
        UgsAdminV2ModelRoutes(
            provider_defaults={"llama": "provider-model"},
            type_overrides={"text_chat": "provider-model", "old_type": None},
        )
    )

    assert entries == [
        ("provider_defaults.llama", "set"),
        ("type_overrides.text_chat", "set"),
        ("type_overrides.old_type", "deleted"),
    ]


def test_validate_model_routes_surfaces_unknown_routes() -> None:
    state = _State(
        providers=[
            {
                "provider_name": "llama",
                "provider_type": "llama",
                "config_json": {"models": ["known-model"], "default_model": "known-model"},
            }
        ],
        types=[
            {
                "type_key": "text_chat",
                "category": "text",
                "provider": "llama",
            }
        ],
        workflows=[],
        model_routes=UgsAdminV2ModelRoutes(
            provider_defaults={"missing-provider": "ghost-model"},
            request_model_override_allowlist=["missing_type"],
        ),
    )
    inventory = UGSModelRoutingService(None).build_inventory(state.providers)  # type: ignore[arg-type]

    issues = validate_model_routes(state=state, model_inventory=inventory)

    assert any(issue.field == "provider_defaults" and issue.entity_id == "missing-provider" for issue in issues)
    assert any(issue.field == "request_model_override_allowlist" for issue in issues)


def test_validate_model_routes_rejects_embedding_model_routes() -> None:
    state = _State(
        providers=[
            {
                "provider_name": "imc_rag_research_provider",
                "provider_type": "miso",
                "config_json": {
                    "models": ["qwen3-14b-q4_k_m.gguf", "Qwen3-Embedding-4B-Q4_K_M.gguf"],
                    "default_model": "qwen3-14b-q4_k_m.gguf",
                },
            }
        ],
        types=[
            {
                "type_key": "imc_rag_swot",
                "category": "document",
                "provider": "imc_rag_research_provider",
            }
        ],
        workflows=[],
        model_routes=UgsAdminV2ModelRoutes(
            provider_defaults={"imc_rag_research_provider": "Qwen3-Embedding-4B-Q4_K_M.gguf"},
            type_overrides={"imc_rag_swot": "Qwen3-Embedding-4B-Q4_K_M.gguf"},
        ),
    )
    inventory = UGSModelRoutingService(None).build_inventory(state.providers)  # type: ignore[arg-type]

    issues = validate_model_routes(state=state, model_inventory=inventory)

    assert sum(1 for issue in issues if issue.severity == "error" and "Embedding model" in issue.message) == 2


def test_apply_ops_dry_run_settings_create_patch_delete() -> None:
    state = _State(
        providers=[],
        types=[],
        workflows=[],
        settings=[
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "scope": "global",
                "key": "model_routes",
                "value": {"global_default_model": "old-model"},
                "description": "routes",
                "company_id": None,
                "project_id": None,
                "user_id": None,
            }
        ],
    )

    created = apply_ops_dry_run(
        state,
        [
            UgsAdminV2SettingCreateOperation(
                setting=UGSSettingCreate(scope="global", key="queue_limits", value={"max": 10})
            )
        ],
    )
    assert len(created.settings or []) == 2
    assert any(item.get("key") == "queue_limits" for item in created.settings or [])

    patched = apply_ops_dry_run(
        created,
        [
            UgsAdminV2SettingPatchOperation(
                setting_ids=["00000000-0000-0000-0000-000000000001"],
                patch=UGSSettingUpdate(value={"global_default_model": "new-model"}),
            )
        ],
    )
    existing = next(item for item in patched.settings or [] if item.get("key") == "model_routes")
    assert existing["value"] == {"global_default_model": "new-model"}

    deleted = apply_ops_dry_run(
        patched,
        [UgsAdminV2SettingDeleteOperation(setting_ids=["00000000-0000-0000-0000-000000000001"])],
    )
    assert [item.get("key") for item in deleted.settings or []] == ["queue_limits"]


def test_setting_natural_key_detects_duplicate_scope_key() -> None:
    left = _setting_natural_key({"scope": "global", "key": "model_routes"})
    right = _setting_natural_key(
        {
            "scope": "global",
            "key": "model_routes",
            "company_id": None,
            "project_id": None,
            "user_id": None,
        }
    )
    assert left == right


def test_dry_run_type_and_workflow_create() -> None:
    from api.schemas.ugs_admin import (
        ComfyUIWorkflowCreate,
        GenerationTypeCreate,
        UgsAdminV2TypeCreateOperation,
        UgsAdminV2WorkflowCreateOperation,
    )

    state = _State(providers=[], types=[], workflows=[], settings=[])
    next_state = apply_ops_dry_run(
        state,
        [
            UgsAdminV2TypeCreateOperation(
                generation_type=GenerationTypeCreate(
                    type_key="custom_text",
                    category="text",
                    display_name="Custom text",
                    provider="llama",
                    model_name="",
                )
            ),
            UgsAdminV2WorkflowCreateOperation(
                workflow=ComfyUIWorkflowCreate(
                    name="Demo",
                    slug="demo-wf",
                    json_body={"1": {"class_type": "LoadImage", "inputs": {}}},
                )
            ),
        ],
    )
    assert any(t.get("type_key") == "custom_text" for t in next_state.types)
    assert any(w.get("slug") == "demo-wf" for w in next_state.workflows)
