"""ACE Step Comfy: нормализация keyscale (enum из 34 значений)."""

from __future__ import annotations

from api.services.studio_comfy_workflows import normalize_keyscale_for_ace_comfy


def test_am_to_a_minor() -> None:
    assert normalize_keyscale_for_ace_comfy("Am") == "A minor"


def test_f_sharp_m_minor() -> None:
    assert normalize_keyscale_for_ace_comfy("F#m") == "F# minor"


def test_canonical_unchanged() -> None:
    assert normalize_keyscale_for_ace_comfy("C major") == "C major"
    assert normalize_keyscale_for_ace_comfy("a minor") == "A minor"


def test_unknown_falls_back() -> None:
    assert normalize_keyscale_for_ace_comfy("H minor") == "C major"


def test_empty_default() -> None:
    assert normalize_keyscale_for_ace_comfy("") == "C major"
    assert normalize_keyscale_for_ace_comfy(None) == "C major"
