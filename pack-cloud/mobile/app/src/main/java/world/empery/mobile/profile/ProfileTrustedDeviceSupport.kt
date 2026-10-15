/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Trusted-device pairing payload parse/resolve and WG tunnel metadata helpers (W1 C4).
 *
 * Invariants:
 * - Pairing JSON must include challenge_id + challenge_nonce; code-only path hits resolve API.
 *
 * Related:
 * - ProfileTrustedDeviceController, MobileTrustedDeviceKeyStore
 */
package world.empery.mobile.profile

import android.os.Build
import feature.profile.R
import org.json.JSONObject
import world.empery.mobile.core.network.api.MobilePairingChallengeResolveBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceDto
import world.empery.mobile.trusteddevice.MobileTrustedDeviceTunnelMetadata
import world.empery.mobile.trusteddevice.TrustedDeviceBindingSync

internal data class TrustedDevicePairingPayload(
    val challengeId: String,
    val pairingCode: String,
    val challengeNonce: String,
)

internal fun defaultTrustedDeviceLabel(): String =
    listOf(Build.MANUFACTURER, Build.MODEL)
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .joinToString(" ")
        .ifBlank { "Android device" }

internal suspend fun resolveTrustedDevicePairing(
    bag: ProfileSessionBag,
    raw: String,
): TrustedDevicePairingPayload {
    val trimmed = raw.trim()
    if (trimmed.contains('{')) {
        return parseTrustedDevicePairingPayload(bag, trimmed)
    }
    val code = trimmed.filter { it.isDigit() }
    if (code.length < 6) {
        throw IllegalArgumentException(
            bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
        )
    }
    val resolved =
        bag.container.mobileTrustedDeviceApi.resolvePairingChallenge(
            MobilePairingChallengeResolveBody(pairingCode = code),
        )
    return TrustedDevicePairingPayload(
        challengeId = resolved.challengeId,
        pairingCode = resolved.pairingCode,
        challengeNonce = resolved.challengeNonce,
    )
}

internal fun parseTrustedDevicePairingPayload(
    bag: ProfileSessionBag,
    raw: String,
): TrustedDevicePairingPayload {
    val trimmed = raw.trim()
    val jsonStart = trimmed.indexOf('{')
    if (jsonStart < 0) {
        throw IllegalArgumentException(
            bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
        )
    }
    val leadingCode =
        trimmed.substring(0, jsonStart).lineSequence().firstOrNull { it.isNotBlank() }?.trim()
    val obj = JSONObject(trimmed.substring(jsonStart))
    val pairingCode =
        obj.optString("pairing_code").takeIf { it.isNotBlank() }
            ?: leadingCode
            ?: throw IllegalArgumentException(
                bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
            )
    val challengeId =
        obj.optString("challenge_id").takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException(
                bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
            )
    val challengeNonce =
        obj.optString("challenge_nonce").takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException(
                bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
            )
    return TrustedDevicePairingPayload(
        challengeId = challengeId,
        pairingCode = pairingCode,
        challengeNonce = challengeNonce,
    )
}

internal fun tunnelMetadataFromTunnelDto(
    tunnel: world.empery.mobile.core.network.api.MobileTrustedDeviceTunnelDto?,
): MobileTrustedDeviceTunnelMetadata? {
    if (tunnel == null) return null
    val interfaceAddress = tunnel.interfaceAddress?.trim().orEmpty()
    val dns = tunnel.dns?.trim().orEmpty()
    val allowedIps = tunnel.allowedIps?.trim().orEmpty()
    val endpoint = tunnel.endpoint?.trim().orEmpty()
    val serverPublicKey = tunnel.serverPublicKey?.trim().orEmpty()
    if (
        interfaceAddress.isBlank() ||
        dns.isBlank() ||
        allowedIps.isBlank() ||
        endpoint.isBlank() ||
        serverPublicKey.isBlank()
    ) {
        return null
    }
    return MobileTrustedDeviceTunnelMetadata(
        interfaceAddress = interfaceAddress,
        dns = dns,
        allowedIps = allowedIps,
        endpoint = endpoint,
        serverPublicKey = serverPublicKey,
        persistentKeepalive = tunnel.persistentKeepalive ?: 25,
        mtu = tunnel.mtu ?: 1280,
    )
}

internal fun tunnelMetadataFromDevice(device: MobileTrustedDeviceDto?): MobileTrustedDeviceTunnelMetadata? {
    if (device == null) return null
    val interfaceAddress =
        device.wgAssignedIp?.trim()?.takeIf { it.isNotEmpty() }?.let { ip ->
            if (ip.contains('/')) ip else "$ip/32"
        }.orEmpty()
    val dns = device.wgDns?.trim().orEmpty()
    val allowedIps = device.wgAllowedIps?.trim().orEmpty()
    val endpoint = device.wgEndpoint?.trim().orEmpty()
    val serverPublicKey = device.wgServerPublicKey?.trim().orEmpty()
    if (
        interfaceAddress.isBlank() ||
        dns.isBlank() ||
        allowedIps.isBlank() ||
        endpoint.isBlank() ||
        serverPublicKey.isBlank()
    ) {
        return null
    }
    return MobileTrustedDeviceTunnelMetadata(
        interfaceAddress = interfaceAddress,
        dns = dns,
        allowedIps = allowedIps,
        endpoint = endpoint,
        serverPublicKey = serverPublicKey,
        persistentKeepalive = 25,
        mtu = 1280,
    )
}

internal suspend fun resolveActiveTrustedDeviceIdForRevoke(bag: ProfileSessionBag): String? {
    bag.uiState.value.trustedDeviceBinding.activeDeviceId
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?.let { return it }
    return bag.container.mobileTrustedDeviceApi
        .listDevices(System.currentTimeMillis())
        .items
        .firstOrNull { item -> TrustedDeviceBindingSync.isActiveStatus(item.status) }
        ?.id
        ?.trim()
        ?.takeIf { it.isNotBlank() }
}
