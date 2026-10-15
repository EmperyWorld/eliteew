# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Piper runtime seed + stack9 TTS voice normalization for UGS.
# Related:
# - api/services/ugs/provider_runtime_seeds.py
# - api/services/ugs/provider_execution_media.py
# ---

from api.services.ugs.provider_execution_media import ProviderExecutionMediaMixin
from api.services.ugs.provider_runtime_seeds import get_runtime_provider_seed


def test_piper_runtime_seed_points_at_stack9_piper() -> None:
    seed = get_runtime_provider_seed("piper")
    assert seed is not None
    assert seed["provider_name"] == "piper"
    assert seed["provider_type"] == "piper"
    assert seed["base_url"] == "http://stack9-piper:8000"
    assert seed["config_json"]["defaults"]["voice"] == "irina"


def test_silero_runtime_seed_unchanged() -> None:
    seed = get_runtime_provider_seed("silero")
    assert seed is not None
    assert seed["provider_type"] == "silero"
    assert seed["base_url"] == "http://stack9-silero:8000"
    assert seed["config_json"]["defaults"]["voice"] == "xenia"


def test_normalize_piper_voice_aliases_to_irina() -> None:
    assert (
        ProviderExecutionMediaMixin._normalize_stack9_tts_voice(  # noqa: SLF001
            "xenia", provider_type="piper"
        )
        == "irina"
    )
    assert (
        ProviderExecutionMediaMixin._normalize_stack9_tts_voice(  # noqa: SLF001
            "companion_ewa", provider_type="piper"
        )
        == "irina"
    )
    assert (
        ProviderExecutionMediaMixin._normalize_silero_voice("female")  # noqa: SLF001
        == "xenia"
    )
