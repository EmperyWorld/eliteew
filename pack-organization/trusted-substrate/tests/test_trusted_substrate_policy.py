# Purpose: Narrow behavioral tests for Trusted Substrate W0–W7a policy locks.
# Related: ELITEEW-TRUSTED-SUBSTRATE-PLAN.md W0–W7a

from __future__ import annotations

from pathlib import Path

import pytest

from policy.image_forbidden_globs import path_is_forbidden, scan_forbidden_paths
from policy.network_handoff import (
    NetworkChannelState,
    evaluate_network_channel,
    is_fake_connected_forbidden,
)
from policy.payload_profile import (
    PayloadProfile,
    PayloadProfileError,
    resolve_payload_profile,
)
from policy.pins import PinsError, assert_required_pins, parse_pins
from policy.spdx_allowlist import (
    SpdxAllowlistError,
    assert_spdx_allowed,
    gate_manifest_rows,
    load_allowlist,
)
from policy.toolchain_identity import (
    assert_identity_match,
    combine_identity,
    pins_digest,
)
from policy.trust_labels import TrustLabelError, validate_trust_labels
from policy.update_channels import UpdateChannel, update_channel_precedence

_ROOT = Path(__file__).resolve().parents[1]


def test_resolve_payload_profile_electron_only() -> None:
    assert (
        resolve_payload_profile(electron=True, tauri=False) is PayloadProfile.ELECTRON
    )


def test_resolve_payload_profile_tauri_only() -> None:
    assert resolve_payload_profile(electron=False, tauri=True) is PayloadProfile.TAURI


def test_resolve_payload_profile_empiieros_shell_only() -> None:
    assert (
        resolve_payload_profile(electron=False, tauri=False, empiieros_shell=True)
        is PayloadProfile.EMPIIEROS_SHELL
    )


def test_resolve_payload_profile_dual_fails() -> None:
    with pytest.raises(PayloadProfileError, match="dual_payload_profile"):
        resolve_payload_profile(electron=True, tauri=True)


def test_resolve_payload_profile_missing_fails() -> None:
    with pytest.raises(PayloadProfileError, match="missing_payload_profile"):
        resolve_payload_profile(electron=False, tauri=False)


def test_trust_labels_electron_bootstrap_ok() -> None:
    os_v, pay_v = validate_trust_labels(
        os_trust="pilot",
        payload_trust="bootstrap-electron",
        profile=PayloadProfile.ELECTRON,
    )
    assert os_v.value == "pilot"
    assert pay_v.value == "bootstrap-electron"


def test_trust_labels_empiieros_shell_ok() -> None:
    os_v, pay_v = validate_trust_labels(
        os_trust="from-source",
        payload_trust="eliteew-runtime",
        profile=PayloadProfile.EMPIIEROS_SHELL,
    )
    assert os_v.value == "from-source"
    assert pay_v.value == "eliteew-runtime"


def test_trust_labels_profile_mismatch() -> None:
    with pytest.raises(TrustLabelError, match="profile_label_mismatch"):
        validate_trust_labels(
            os_trust="pilot",
            payload_trust="tauri-living",
            profile=PayloadProfile.ELECTRON,
        )


def test_trust_labels_invalid_os() -> None:
    with pytest.raises(TrustLabelError, match="invalid_os_trust"):
        validate_trust_labels(
            os_trust="trusted-magic",
            payload_trust="bootstrap-electron",
            profile=PayloadProfile.ELECTRON,
        )


def test_trust_labels_tauri_living_ok() -> None:
    os_v, pay_v = validate_trust_labels(
        os_trust="pilot",
        payload_trust="tauri-living",
        profile=PayloadProfile.TAURI,
    )
    assert os_v.value == "pilot"
    assert pay_v.value == "tauri-living"


def test_trust_labels_tauri_rejects_bootstrap() -> None:
    with pytest.raises(TrustLabelError, match="profile_label_mismatch"):
        validate_trust_labels(
            os_trust="pilot",
            payload_trust="bootstrap-electron",
            profile=PayloadProfile.TAURI,
        )


def test_forbidden_wg_conf() -> None:
    assert path_is_forbidden("etc/wireguard/wg0.conf") is not None
    assert path_is_forbidden("etc/wireguard/wg-portal.conf") is not None


def test_forbidden_scan_tree(tmp_path: Path) -> None:
    clean = tmp_path / "clean"
    clean.mkdir()
    (clean / "usr" / "bin").mkdir(parents=True)
    (clean / "usr" / "bin" / "eliteew-kiosk").write_text("ok\n", encoding="utf-8")
    assert scan_forbidden_paths(clean) == []

    dirty = tmp_path / "dirty"
    dirty.mkdir()
    wg = dirty / "etc" / "wireguard"
    wg.mkdir(parents=True)
    (wg / "wg-portal.conf").write_text("PrivateKey = PLACEHOLDER\n", encoding="utf-8")
    hits = scan_forbidden_paths(dirty)
    assert len(hits) == 1
    assert hits[0][0].endswith("wg-portal.conf")


def test_update_channel_os_wins() -> None:
    assert (
        update_channel_precedence(
            os_update_pending=True, payload_update_pending=True
        )
        is UpdateChannel.OS
    )


def test_update_channel_payload_only() -> None:
    assert (
        update_channel_precedence(
            os_update_pending=False, payload_update_pending=True
        )
        is UpdateChannel.PAYLOAD
    )


def test_update_channel_none() -> None:
    assert (
        update_channel_precedence(
            os_update_pending=False, payload_update_pending=False
        )
        is UpdateChannel.NONE
    )


def test_network_peer_missing() -> None:
    state = evaluate_network_channel(
        peer_conf_present=False, interface_up=False, handshake_ok=False
    )
    assert state is NetworkChannelState.PEER_MISSING
    assert is_fake_connected_forbidden(state) is True


def test_network_degraded() -> None:
    state = evaluate_network_channel(
        peer_conf_present=True, interface_up=True, handshake_ok=False
    )
    assert state is NetworkChannelState.DEGRADED
    assert is_fake_connected_forbidden(state) is True


def test_network_tunnel_up() -> None:
    state = evaluate_network_channel(
        peer_conf_present=True, interface_up=True, handshake_ok=True
    )
    assert state is NetworkChannelState.TUNNEL_UP
    assert is_fake_connected_forbidden(state) is False


def test_spdx_allowlist_accepts_known() -> None:
    allow = load_allowlist(_ROOT / "licenses" / "ALLOWLIST")
    assert_spdx_allowed("MIT", allow)
    assert_spdx_allowed("GPL-3.0-or-later", allow)


def test_spdx_allowlist_rejects_unknown() -> None:
    allow = load_allowlist(_ROOT / "licenses" / "ALLOWLIST")
    with pytest.raises(SpdxAllowlistError, match="spdx_not_allowed"):
        assert_spdx_allowed("Proprietary-Evil", allow)


def test_spdx_gate_manifest_fail_closed() -> None:
    allow = load_allowlist(_ROOT / "licenses" / "ALLOWLIST")
    with pytest.raises(SpdxAllowlistError):
        gate_manifest_rows([("pkg", "Not-A-Real-SPDX")], allow)


def test_pins_file_parses_and_has_required() -> None:
    rows = parse_pins(_ROOT / "toolchain" / "PINS")
    assert_required_pins(rows)
    allow = load_allowlist(_ROOT / "licenses" / "ALLOWLIST")
    gate_manifest_rows([(r.name, r.spdx) for r in rows], allow)


def test_pins_bad_sha_rejected(tmp_path: Path) -> None:
    p = tmp_path / "PINS"
    p.write_text(
        "gcc 1.0 a.tar.xz https://example.com/a.tar.xz deadbeef MIT\n",
        encoding="utf-8",
    )
    with pytest.raises(PinsError, match="pins_bad_sha256"):
        parse_pins(p)


def test_toolchain_identity_match_and_mismatch(tmp_path: Path) -> None:
    pins = tmp_path / "PINS"
    pins.write_text(
        "gcc 14.2.0 gcc.tar.xz https://example.com/gcc.tar.xz "
        "a7b39bc69cbf9e25826c5a60ab26477001f7c08d85cec04bc0e29cabed6f3cc9 "
        "GPL-3.0-or-later\n",
        encoding="utf-8",
    )
    d = pins_digest(pins)
    a = combine_identity(pins_sha256=d, artifact_sha256="aa" * 32)
    b = combine_identity(pins_sha256=d, artifact_sha256="aa" * 32)
    assert_identity_match(a, b)
    with pytest.raises(ValueError, match="toolchain_identity_mismatch"):
        assert_identity_match(a, combine_identity(pins_sha256=d, artifact_sha256="bb" * 32))


def test_trust_labels_from_source_tauri_ok() -> None:
    os_v, pay_v = validate_trust_labels(
        os_trust="from-source",
        payload_trust="tauri-living",
        profile=PayloadProfile.TAURI,
    )
    assert os_v.value == "from-source"
    assert pay_v.value == "tauri-living"


def test_trust_labels_from_source_electron_ok() -> None:
    os_v, pay_v = validate_trust_labels(
        os_trust="from-source",
        payload_trust="bootstrap-electron",
        profile=PayloadProfile.ELECTRON,
    )
    assert os_v.value == "from-source"
    assert pay_v.value == "bootstrap-electron"


def test_rootfs_package_gate_allows_fragments() -> None:
    from policy.rootfs_packages import gate_config_text

    text = (_ROOT / "config/buildroot/fragments/10-base.frag").read_text(
        encoding="utf-8"
    )
    text += (_ROOT / "config/buildroot/fragments/20-network-base.frag").read_text(
        encoding="utf-8"
    )
    text += (
        _ROOT / "config/buildroot/fragments/30-display-tauri-wayland.frag"
    ).read_text(encoding="utf-8")
    enabled = gate_config_text(text, _ROOT / "config/buildroot/package-allowlist")
    assert "BUSYBOX" in enabled
    assert "WIREGUARD_TOOLS" in enabled
    assert "WLROOTS" in enabled
    assert "LABWC" in enabled
    assert "WEBKITGTK" in enabled
    assert "MESA3D" in enabled


def test_rootfs_package_gate_rejects_unknown() -> None:
    from policy.rootfs_packages import RootfsPackageError, gate_config_text

    with pytest.raises(RootfsPackageError, match="packages_not_allowed"):
        gate_config_text(
            "BR2_PACKAGE_BUSYBOX=y\nBR2_PACKAGE_EVIL=y\n",
            _ROOT / "config/buildroot/package-allowlist",
        )


def test_toolchain_sot_requires_prefix(tmp_path: Path) -> None:
    from policy.toolchain_sot import ToolchainSotError, assert_eliteew_toolchain_sot

    with pytest.raises(ToolchainSotError):
        assert_eliteew_toolchain_sot(tmp_path / "nope")

    prefix = tmp_path / "prefix"
    (prefix / "bin").mkdir(parents=True)
    (prefix / "etc").mkdir(parents=True)
    gcc = prefix / "bin" / "gcc"
    gcc.write_text("#!/bin/sh\n", encoding="utf-8")
    gcc.chmod(0o755)
    (prefix / "etc" / "eliteew-ts-toolchain.identity").write_text("id\n", encoding="utf-8")
    (prefix / "etc" / "eliteew-ts-toolchain.env").write_text(
        "toolchain_bootstrap=eliteew\n", encoding="utf-8"
    )
    assert assert_eliteew_toolchain_sot(prefix) == gcc


def test_buildroot_pin_parses() -> None:
    rows = parse_pins(_ROOT / "config/buildroot/BUILDROOT.pin")
    assert len(rows) == 1
    assert rows[0].name == "buildroot"
    assert rows[0].version == "2025.02.1"


def test_image_signing_classify_missing() -> None:
    from policy.image_signing import VerifyOutcome, classify_verify_inputs

    o = classify_verify_inputs(
        image=_ROOT / "no-such-image",
        signature=_ROOT / "no.sig",
        pubkey=_ROOT / "no.pub",
    )
    assert o is VerifyOutcome.MISSING_IMAGE


def test_image_signing_assert_ok_and_fail() -> None:
    from policy.image_signing import (
        ImageSigningError,
        VerifyOutcome,
        assert_verify_ok,
        outcome_from_openssl_verify,
    )

    assert_verify_ok(outcome_from_openssl_verify(0))
    with pytest.raises(ImageSigningError):
        assert_verify_ok(VerifyOutcome.TAMPER_OR_BAD_SIG)


def test_private_key_material_absent() -> None:
    from policy.image_signing import ImageSigningError, assert_private_key_material_absent

    assert_private_key_material_absent("public config only")
    with pytest.raises(ImageSigningError, match="private_key_material"):
        assert_private_key_material_absent("-----BEGIN PRIVATE KEY-----\nMII")


def test_payload_slot_apply_and_rollback_once() -> None:
    from policy.payload_slots import (
        PayloadSlot,
        PayloadSlotError,
        PayloadSlotState,
        apply_to_inactive,
        rollback_once,
    )

    # Seeded active A (v0) → apply B → rollback to A
    s0 = PayloadSlotState(PayloadSlot.A, False, "v0", "")
    s1 = apply_to_inactive(s0, new_version="v1")
    assert s1.active is PayloadSlot.B
    assert s1.version_b == "v1"
    assert s1.rollback_available is True
    s2 = rollback_once(s1)
    assert s2.active is PayloadSlot.A
    assert s2.rollback_available is False
    with pytest.raises(PayloadSlotError, match="rollback_not_available"):
        rollback_once(s2)


def test_payload_slot_first_apply_no_rollback_when_empty() -> None:
    from policy.payload_slots import (
        PayloadSlot,
        PayloadSlotError,
        PayloadSlotState,
        apply_to_inactive,
        rollback_once,
    )

    empty = PayloadSlotState(PayloadSlot.A, False, "", "")
    s1 = apply_to_inactive(empty, new_version="v1")
    assert s1.active is PayloadSlot.B
    assert s1.rollback_available is False
    with pytest.raises(PayloadSlotError, match="rollback_not_available"):
        rollback_once(s1)


def test_payload_slot_os_pending_blocks() -> None:
    from policy.payload_slots import PayloadSlot, PayloadSlotError, PayloadSlotState, apply_to_inactive

    s0 = PayloadSlotState(PayloadSlot.A, False, "v0", "")
    with pytest.raises(PayloadSlotError, match="os_update_pending_blocks_payload"):
        apply_to_inactive(s0, new_version="v1", os_update_pending=True)

