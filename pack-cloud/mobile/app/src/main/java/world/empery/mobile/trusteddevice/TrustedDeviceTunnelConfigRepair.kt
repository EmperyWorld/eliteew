package world.empery.mobile.trusteddevice

import android.util.Log
import world.empery.mobile.MobileApp
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.profile.tunnelMetadataFromTunnelDto
import world.empery.mobile.tunnel.MobilePrivateTunnelConfigStore

object TrustedDeviceTunnelConfigRepair {
    private const val TAG = "TrustedDeviceTunnelRepair"

    suspend fun repairServerPublicKeyDriftIfNeeded(app: MobileApp): Boolean {
        val container = app.container
        if (!container.authRepository.hasSession()) {
            return false
        }
        val configStore = MobilePrivateTunnelConfigStore(app)
        val storedServerKey = configStore.readPeerPublicKey()?.trim().orEmpty()
        if (storedServerKey.isEmpty()) {
            return false
        }
        val keyStore = MobileTrustedDeviceKeyStore(app)
        if (!keyStore.capability().wireGuardKeyPresent) {
            return false
        }
        val response =
            runCatching {
                container.mobileTrustedDeviceApi.getActiveTunnelMetadata(
                    cacheBust = System.currentTimeMillis(),
                )
            }.getOrElse { err ->
                Log.w(TAG, "[STEP] trusted_device_tunnel_repair metadata_fetch_failed", err)
                return false
            }
        val metadata = tunnelMetadataFromTunnelDto(response.tunnel) ?: return false
        val serverKey = metadata.serverPublicKey.trim()
        if (serverKey.isEmpty() || serverKey == storedServerKey) {
            return false
        }
        return runCatching {
            val wgConfig = keyStore.buildWireGuardConfig(metadata)
            val tunnelManager = container.mobilePrivateTunnelManager
            tunnelManager.importConfig(wgConfig)
            Log.i(
                TAG,
                "[STEP] trusted_device_tunnel_repair server_pubkey_drift old=${storedServerKey.take(12)} new=${serverKey.take(12)}",
            )
            MobileTelemetry.trackBusinessEvent(
                "trusted_device_tunnel_server_pubkey_repair",
                mapOf(
                    "device_id" to response.deviceId.trim(),
                    "old_prefix" to storedServerKey.take(12),
                    "new_prefix" to serverKey.take(12),
                ),
            )
            true
        }.onFailure { err ->
            MobileTelemetry.reportError(err, "trusted_device_tunnel_server_pubkey_repair_failed")
            Log.w(TAG, "[STEP] trusted_device_tunnel_repair failed", err)
        }.getOrDefault(false)
    }
}
