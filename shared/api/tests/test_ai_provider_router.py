# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for AI provider pack policy (client edition hard floor).
# Invariants:
# - Forbidden preference fails closed; empty allowlist uses edition defaults.
# Related:
# - api/services/ai_provider_router/policy.py
# - api/services/ai_provider_router/runtime.py (O3a probes)
# ---

from __future__ import annotations

import pytest

from api.services.ai_provider_router import (
    AiProviderKind,
    AiProviderNotConfiguredError,
    parse_allowlist,
    resolve_provider_kind,
)


def test_client_defaults_to_local() -> None:
    assert resolve_provider_kind(edition="client") == AiProviderKind.LOCAL


def test_user_pref_cannot_bypass_allowlist() -> None:
    allow = frozenset({AiProviderKind.LOCAL})
    with pytest.raises(AiProviderNotConfiguredError, match="forbidden"):
        resolve_provider_kind(
            edition="client",
            allowlist=allow,
            user_preference=AiProviderKind.ELITEEW,
        )


def test_user_pref_wins_when_allowed() -> None:
    assert (
        resolve_provider_kind(
            edition="client",
            allowlist=frozenset({AiProviderKind.LOCAL, AiProviderKind.THIRD_PARTY}),
            user_preference="ai.third_party",
        )
        == AiProviderKind.THIRD_PARTY
    )


def test_parse_allowlist_empty_uses_edition_default() -> None:
    kinds = parse_allowlist("", edition="client")
    assert kinds == frozenset({AiProviderKind.LOCAL})
    assert AiProviderKind.ELITEEW not in kinds
    assert AiProviderKind.THIRD_PARTY not in kinds


def test_client_pref_cannot_enable_eliteew_without_allowlist() -> None:
    with pytest.raises(AiProviderNotConfiguredError, match="forbidden"):
        resolve_provider_kind(
            edition="client",
            user_preference=AiProviderKind.ELITEEW,
        )


def test_parse_allowlist_unknown_fail_closed() -> None:
    with pytest.raises(AiProviderNotConfiguredError, match="unknown"):
        parse_allowlist("ai.local,ai.bogus", edition="client")


def test_cloud_default_prefers_local_then_falls_through() -> None:
    # Same priority order; cloud allowlist includes local first.
    assert resolve_provider_kind(edition="cloud") == AiProviderKind.LOCAL
    assert resolve_provider_kind(edition="cloud", default="ai.eliteew") == AiProviderKind.ELITEEW


def test_runtime_reads_unified_config(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ai_provider_router import runtime as rt

    monkeypatch.setattr(
        rt,
        "_settings_ai_inputs",
        lambda: ("client", "ai.eliteew", "ai.local,ai.eliteew"),
    )
    snap = rt.get_active_ai_provider_snapshot()
    assert snap.edition == "client"
    assert snap.provider == AiProviderKind.ELITEEW
    assert AiProviderKind.LOCAL in snap.allowlist


def test_runtime_user_pref_blocked_by_env_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ai_provider_router import runtime as rt

    monkeypatch.setattr(rt, "_settings_ai_inputs", lambda: ("client", "", "ai.local"))
    with pytest.raises(AiProviderNotConfiguredError, match="forbidden"):
        rt.get_active_ai_provider_kind(user_preference="ai.eliteew")


def test_eliteew_http_probe_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    import api.services.ai_provider_router.adapters_eliteew_http as ad

    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(llama_url="http://stack2-llama:11434", default_ai_model="m"),
    )
    probe = ad.probe_eliteew_http_provider()
    assert probe.is_configured() is True
    assert probe.base_url == "http://stack2-llama:11434"
    assert probe.model == "m"


def test_eliteew_http_probe_empty_not_configured() -> None:
    from api.services.ai_provider_router.adapters_eliteew_http import (
        EliteewHttpProviderProbe,
    )

    assert EliteewHttpProviderProbe(base_url="").is_configured() is False


def test_local_and_third_party_probes(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    import api.services.ai_provider_router.adapters_local as local_ad
    import api.services.ai_provider_router.adapters_third_party as third_ad

    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(
            eliteew_ai_local_base_url="http://127.0.0.1:11434",
            eliteew_ai_local_model="llama",
            eliteew_ai_third_party_base_url="",
            eliteew_ai_third_party_model="",
        ),
    )
    local = local_ad.probe_local_ai_provider()
    assert local.is_configured() is True
    assert local.base_url.endswith("11434")
    third = third_ad.probe_third_party_ai_provider()
    assert third.is_configured() is False


def test_probe_active_and_all(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from api.services.ai_provider_router import runtime as rt
    from api.services.ai_provider_router.policy import AiProviderKind

    monkeypatch.setattr(rt, "_settings_ai_inputs", lambda: ("client", "ai.local", ""))
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(
            eliteew_ai_local_base_url="http://127.0.0.1:11434",
            eliteew_ai_local_model="",
            eliteew_ai_third_party_base_url="",
            eliteew_ai_third_party_model="",
            llama_url="",
            default_ai_model="",
        ),
    )
    active = rt.probe_active_provider()
    assert active.kind == AiProviderKind.LOCAL
    assert active.configured is True
    all_probes = rt.probe_all_providers()
    assert all_probes[AiProviderKind.LOCAL].configured is True
    assert all_probes[AiProviderKind.ELITEEW].configured is False


def test_unified_config_ai_fields_defaults() -> None:
    from api.core.unified_config import UnifiedConfig

    # Required Field(...) models must be passed; avoid `_env_file` (not in pyright ctor).
    cfg = UnifiedConfig(
        database_password="x" * 16,
        marketing_cabinet_router_model="test-router",
        default_ai_model="test-model",
        embedding_ai_model="test-embed",
    )
    assert cfg.eliteew_ai_provider_default == ""
    assert cfg.eliteew_ai_providers_allowlist == ""
    assert cfg.eliteew_ai_local_base_url == ""
    assert cfg.eliteew_ai_third_party_base_url == ""
    assert cfg.eliteew_ai_third_party_api_key == ""


def test_resolve_completion_endpoint_local(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from api.services.ai_provider_router import completions as comp
    from api.services.ai_provider_router import runtime as rt
    from api.services.ai_provider_router.policy import AiProviderKind

    monkeypatch.setattr(rt, "_settings_ai_inputs", lambda: ("client", "ai.local", ""))
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(
            eliteew_ai_local_base_url="http://127.0.0.1:11434",
            eliteew_ai_local_model="llama3.2",
            eliteew_ai_third_party_base_url="",
            eliteew_ai_third_party_model="",
            eliteew_ai_third_party_api_key="",
            llama_url="",
            default_ai_model="",
        ),
    )
    ep = comp.resolve_active_completion_endpoint()
    assert ep.kind == AiProviderKind.LOCAL
    assert ep.base_url.endswith("11434")
    assert ep.model == "llama3.2"
    assert ep.api_key is None


def test_resolve_completion_endpoint_third_party_requires_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from api.services.ai_provider_router import completions as comp
    from api.services.ai_provider_router import runtime as rt
    from api.services.ai_provider_router.policy import AiProviderNotConfiguredError

    monkeypatch.setattr(rt, "_settings_ai_inputs", lambda: ("client", "ai.third_party", "ai.local,ai.third_party"))
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        SimpleNamespace(
            eliteew_ai_local_base_url="",
            eliteew_ai_local_model="",
            eliteew_ai_third_party_base_url="https://api.openai.com/v1",
            eliteew_ai_third_party_model="gpt-4o-mini",
            eliteew_ai_third_party_api_key="",
            llama_url="",
            default_ai_model="",
        ),
    )
    with pytest.raises(AiProviderNotConfiguredError, match="API key"):
        comp.resolve_active_completion_endpoint()


@pytest.mark.asyncio
async def test_chat_completion_json_dispatches(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ai_provider_router import completions as comp
    from api.services.ai_provider_router.policy import AiProviderKind

    monkeypatch.setattr(
        comp,
        "resolve_active_completion_endpoint",
        lambda **_kwargs: comp.AiProviderCompletionEndpoint(
            kind=AiProviderKind.LOCAL,
            base_url="http://127.0.0.1:11434",
            model="m",
        ),
    )

    async def _fake_json(client, base_url, *, model, messages, options=None, timeout=None):
        assert base_url.endswith("11434")
        assert model == "m"
        assert messages[0]["role"] == "user"
        return {"response": "ok", "prompt_eval_count": 1, "eval_count": 1}

    monkeypatch.setattr(comp, "httpx_compat_chat_completion_json", _fake_json)
    out = await comp.chat_completion_json([{"role": "user", "content": "hi"}])
    assert out["response"] == "ok"


@pytest.mark.asyncio
async def test_chat_completion_stream_dispatches(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ai_provider_router import completions as comp
    from api.services.ai_provider_router.policy import AiProviderKind

    monkeypatch.setattr(
        comp,
        "resolve_active_completion_endpoint",
        lambda **_kwargs: comp.AiProviderCompletionEndpoint(
            kind=AiProviderKind.LOCAL,
            base_url="http://127.0.0.1:11434",
            model="m",
        ),
    )

    async def _fake_stream(client, base_url, *, model, messages, options=None, timeout=None):
        yield "hel"
        yield "lo"

    monkeypatch.setattr(comp, "httpx_compat_chat_completion_stream", _fake_stream)
    chunks: list[str] = []
    async for piece in comp.chat_completion_stream([{"role": "user", "content": "hi"}]):
        chunks.append(piece)
    assert "".join(chunks) == "hello"
