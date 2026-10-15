/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for authenticated mobile APK distribution, support diagnostics, and trusted-device routes.
 *
 * Invariants:
 * - APK bytes are fetched with Bearer auth; never embed tokens in query strings.
 *
 * Related:
 * - shared/api/routers/mobile_app.py, feature.profile.MobileAppUpdateRepository, MobileProfileRepository
 */
package world.empery.mobile.core.network.api

import com.google.gson.annotations.SerializedName

data class MobileReleaseNotesEntryDto(
    @SerializedName("version_code")
    val versionCode: Int,
    @SerializedName("version_name")
    val versionName: String,
    @SerializedName("release_notes")
    val releaseNotes: String,
)

data class MobileAppOverviewResponse(
    @SerializedName("download_page_url")
    val downloadPageUrl: String = "",
    @SerializedName("download_api_path")
    val downloadApiPath: String = "/api/v1/mobile-app/download",
    @SerializedName("apk_available")
    val apkAvailable: Boolean = false,
    @SerializedName("apk_size_bytes")
    val apkSizeBytes: Long? = null,
    @SerializedName("version_code")
    val versionCode: Int? = null,
    @SerializedName("version_name")
    val versionName: String? = null,
    @SerializedName("apk_sha256")
    val apkSha256: String? = null,
    @SerializedName("published_at")
    val publishedAt: String? = null,
    @SerializedName("release_notes")
    val releaseNotes: String? = null,
    @SerializedName("release_notes_history")
    val releaseNotesHistory: List<MobileReleaseNotesEntryDto>? = null,
    @SerializedName("min_supported_version_code")
    val minSupportedVersionCode: Int? = null,
)

data class MobileSupportReportCreateBody(
    @SerializedName("bundle_text")
    val bundleText: String,
    @SerializedName("category")
    val category: String = "general",
    @SerializedName("app_version_name")
    val appVersionName: String? = null,
    @SerializedName("app_version_code")
    val appVersionCode: Int? = null,
    @SerializedName("device_model")
    val deviceModel: String? = null,
)

data class MobileSupportReportResponse(
    @SerializedName("report_id")
    val reportId: String,
    @SerializedName("category")
    val category: String,
    @SerializedName("message")
    val message: String = "",
)

data class MobileAppRealtimeStateBody(
    @SerializedName("foreground")
    val foreground: Boolean,
)

data class MobileAppRealtimeStateResponse(
    @SerializedName("accepted")
    val accepted: Boolean = true,
    @SerializedName("foreground")
    val foreground: Boolean,
)

data class MobileNotificationProfileDto(
    @SerializedName("chat_enabled")
    val chatEnabled: Boolean = true,
    @SerializedName("friends_enabled")
    val friendsEnabled: Boolean = true,
    @SerializedName("ugs_enabled")
    val ugsEnabled: Boolean = true,
    @SerializedName("system_enabled")
    val systemEnabled: Boolean = true,
    @SerializedName("quiet_hours_enabled")
    val quietHoursEnabled: Boolean = false,
    @SerializedName("quiet_hours_start_minute")
    val quietHoursStartMinute: Int = 22 * 60,
    @SerializedName("quiet_hours_end_minute")
    val quietHoursEndMinute: Int = 8 * 60,
)

data class MobileProfileResponse(
    @SerializedName("ui_style")
    val uiStyle: String = "system",
    @SerializedName("color_mode")
    val colorMode: String = "system",
    @SerializedName("ui_scale")
    val uiScale: String = "compact",
    @SerializedName("notifications_enabled")
    val notificationsEnabled: Boolean = true,
    @SerializedName("reduce_motion")
    val reduceMotion: Boolean = false,
    @SerializedName("high_contrast_hint")
    val highContrastHint: Boolean = false,
    @SerializedName("stream_cache_wifi_only")
    val streamCacheWifiOnly: Boolean = false,
    @SerializedName("background_content_id")
    val backgroundContentId: String? = null,
    @SerializedName("updated_at")
    val updatedAt: String? = null,
    @SerializedName("notifications")
    val notifications: MobileNotificationProfileDto? = null,
    /** Mirror of users.preferences.video_calls.call_target (also editable in mobile Profile). */
    @SerializedName("call_target")
    val callTarget: String = "both",
)

data class MobileProfileUpdateBody(
    @SerializedName("ui_style")
    val uiStyle: String? = null,
    @SerializedName("color_mode")
    val colorMode: String? = null,
    @SerializedName("ui_scale")
    val uiScale: String? = null,
    @SerializedName("notifications_enabled")
    val notificationsEnabled: Boolean? = null,
    @SerializedName("reduce_motion")
    val reduceMotion: Boolean? = null,
    @SerializedName("high_contrast_hint")
    val highContrastHint: Boolean? = null,
    @SerializedName("stream_cache_wifi_only")
    val streamCacheWifiOnly: Boolean? = null,
    @SerializedName("background_content_id")
    val backgroundContentId: String? = null,
    @SerializedName("notifications")
    val notifications: MobileNotificationProfileDto? = null,
)

data class MobileTrustedDeviceBindBody(
    @SerializedName("challenge_id")
    val challengeId: String,
    @SerializedName("pairing_code")
    val pairingCode: String,
    @SerializedName("stable_device_id")
    val stableDeviceId: String,
    @SerializedName("device_label")
    val deviceLabel: String,
    @SerializedName("device_public_key")
    val devicePublicKey: String,
    @SerializedName("device_public_key_algorithm")
    val devicePublicKeyAlgorithm: String,
    @SerializedName("signed_challenge")
    val signedChallenge: String,
    @SerializedName("wg_public_key")
    val wgPublicKey: String,
    @SerializedName("gaf_public_key")
    val gafPublicKey: String? = null,
    @SerializedName("gaf_public_key_algorithm")
    val gafPublicKeyAlgorithm: String? = null,
    @SerializedName("capabilities")
    val capabilities: Map<String, Any?> = emptyMap(),
    @SerializedName("metadata")
    val metadata: Map<String, Any?> = emptyMap(),
)

data class MobilePairingChallengeResolveBody(
    @SerializedName("pairing_code")
    val pairingCode: String,
)

data class MobilePairingChallengeResolveResponse(
    @SerializedName("challenge_id")
    val challengeId: String,
    @SerializedName("pairing_code")
    val pairingCode: String,
    @SerializedName("challenge_nonce")
    val challengeNonce: String,
    @SerializedName("expires_at")
    val expiresAt: String,
    @SerializedName("prepare_gaf_e2ee")
    val prepareGafE2ee: Boolean = false,
)

data class MobileTrustedDeviceDto(
    @SerializedName("id")
    val id: String,
    @SerializedName("stable_device_id")
    val stableDeviceId: String = "",
    @SerializedName("device_label")
    val deviceLabel: String = "",
    @SerializedName("status")
    val status: String = "",
    @SerializedName("wg_assigned_ip")
    val wgAssignedIp: String? = null,
    @SerializedName("wg_allowed_ips")
    val wgAllowedIps: String? = null,
    @SerializedName("wg_dns")
    val wgDns: String? = null,
    @SerializedName("wg_endpoint")
    val wgEndpoint: String? = null,
    @SerializedName("wg_server_public_key")
    val wgServerPublicKey: String? = null,
    @SerializedName("gaf_public_key_fingerprint")
    val gafPublicKeyFingerprint: String? = null,
)

data class MobileTrustedDeviceListResponse(
    @SerializedName("items")
    val items: List<MobileTrustedDeviceDto> = emptyList(),
)

data class MobileTrustedDeviceRevokeBody(
    @SerializedName("reason")
    val reason: String? = null,
)

data class MobileTrustedDeviceRotateWgBody(
    @SerializedName("wg_public_key")
    val wgPublicKey: String,
)

data class MobileTrustedDeviceRotateWgResponse(
    @SerializedName("device")
    val device: MobileTrustedDeviceDto,
)

data class MobileTrustedDeviceTunnelDto(
    @SerializedName("interface_address")
    val interfaceAddress: String? = null,
    @SerializedName("dns")
    val dns: String? = null,
    @SerializedName("allowed_ips")
    val allowedIps: String? = null,
    @SerializedName("endpoint")
    val endpoint: String? = null,
    @SerializedName("server_public_key")
    val serverPublicKey: String? = null,
    @SerializedName("persistent_keepalive")
    val persistentKeepalive: Int? = null,
    @SerializedName("mtu")
    val mtu: Int? = null,
)

data class MobileActiveTunnelMetadataResponse(
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("tunnel")
    val tunnel: MobileTrustedDeviceTunnelDto = MobileTrustedDeviceTunnelDto(),
)

data class MobileTrustedDeviceBindResponse(
    @SerializedName("device")
    val device: MobileTrustedDeviceDto,
    @SerializedName("tunnel")
    val tunnel: MobileTrustedDeviceTunnelDto = MobileTrustedDeviceTunnelDto(),
    @SerializedName("gaf_e2ee_ready")
    val gafE2eeReady: Boolean = false,
)

data class MobileDeviceTransferStartBody(
    @SerializedName("old_device_id")
    val oldDeviceId: String,
    @SerializedName("new_device_id")
    val newDeviceId: String,
    @SerializedName("transfer_public_key")
    val transferPublicKey: String,
    @SerializedName("transfer_public_key_algorithm")
    val transferPublicKeyAlgorithm: String = "x25519",
    @SerializedName("metadata")
    val metadata: Map<String, Any?> = emptyMap(),
)

data class MobileDeviceTransferOldConfirmBody(
    @SerializedName("signed_transfer_nonce")
    val signedTransferNonce: String,
    @SerializedName("encrypted_transfer_blob")
    val encryptedTransferBlob: String,
    @SerializedName("encrypted_transfer_blob_metadata")
    val encryptedTransferBlobMetadata: Map<String, Any?> = emptyMap(),
)

data class MobileDeviceTransferEmailConfirmBody(
    @SerializedName("confirmation_token")
    val confirmationToken: String,
)

data class MobileDeviceTransferCompleteBody(
    @SerializedName("new_device_id")
    val newDeviceId: String,
)

data class MobileDeviceTransferDto(
    @SerializedName("id")
    val id: String,
    @SerializedName("old_device_id")
    val oldDeviceId: String? = null,
    @SerializedName("new_device_id")
    val newDeviceId: String? = null,
    @SerializedName("status")
    val status: String,
    @SerializedName("transfer_public_key_fingerprint")
    val transferPublicKeyFingerprint: String,
    @SerializedName("transfer_public_key_algorithm")
    val transferPublicKeyAlgorithm: String,
    @SerializedName("has_encrypted_transfer_blob")
    val hasEncryptedTransferBlob: Boolean = false,
    @SerializedName("expires_at")
    val expiresAt: String,
)

data class MobileDeviceTransferResponse(
    @SerializedName("transfer")
    val transfer: MobileDeviceTransferDto,
)

data class MobileDeviceTransferCompleteResponse(
    @SerializedName("transfer")
    val transfer: MobileDeviceTransferDto,
    @SerializedName("encrypted_transfer_blob")
    val encryptedTransferBlob: String,
    @SerializedName("encrypted_transfer_blob_metadata")
    val encryptedTransferBlobMetadata: Map<String, Any?> = emptyMap(),
)

interface MobileAppApi {
    @retrofit2.http.GET("mobile-app/overview")
    suspend fun getOverview(
        @retrofit2.http.Query("installed_version_code") installedVersionCode: Int? = null,
    ): MobileAppOverviewResponse

    @retrofit2.http.GET("mobile-app/profile")
    suspend fun getMobileProfile(): MobileProfileResponse

    @retrofit2.http.PATCH("mobile-app/profile")
    suspend fun patchMobileProfile(
        @retrofit2.http.Body body: MobileProfileUpdateBody,
    ): MobileProfileResponse

    @retrofit2.http.PUT("mobile-app/realtime-state")
    suspend fun putRealtimeState(
        @retrofit2.http.Body body: MobileAppRealtimeStateBody,
    ): MobileAppRealtimeStateResponse

    @retrofit2.http.POST("mobile-app/support-reports")
    suspend fun submitSupportReport(
        @retrofit2.http.Body body: MobileSupportReportCreateBody,
    ): MobileSupportReportResponse
}

interface MobileTrustedDeviceApi {
    @retrofit2.http.Headers(
        "Cache-Control: no-cache, no-store",
        "Pragma: no-cache",
    )
    @retrofit2.http.GET("mobile-devices")
    suspend fun listDevices(
        @retrofit2.http.Query("_") cacheBust: Long,
        @retrofit2.http.Query("include_inactive") includeInactive: Boolean? = null,
    ): MobileTrustedDeviceListResponse

    @retrofit2.http.Headers(
        "Cache-Control: no-cache, no-store",
        "Pragma: no-cache",
    )
    @retrofit2.http.GET("mobile-devices/active/tunnel-metadata")
    suspend fun getActiveTunnelMetadata(
        @retrofit2.http.Query("_") cacheBust: Long,
    ): MobileActiveTunnelMetadataResponse

    @retrofit2.http.POST("mobile-devices/pairing-challenges/resolve")
    suspend fun resolvePairingChallenge(
        @retrofit2.http.Body body: MobilePairingChallengeResolveBody,
    ): MobilePairingChallengeResolveResponse

    @retrofit2.http.POST("mobile-devices/bind")
    suspend fun bindDevice(
        @retrofit2.http.Body body: MobileTrustedDeviceBindBody,
    ): MobileTrustedDeviceBindResponse

    @retrofit2.http.POST("mobile-devices/{deviceId}/revoke")
    suspend fun revokeDevice(
        @retrofit2.http.Path("deviceId") deviceId: String,
        @retrofit2.http.Body body: MobileTrustedDeviceRevokeBody,
    ): MobileTrustedDeviceBindResponse

    @retrofit2.http.POST("mobile-devices/{deviceId}/rotate-wg")
    suspend fun rotateWgKey(
        @retrofit2.http.Path("deviceId") deviceId: String,
        @retrofit2.http.Body body: MobileTrustedDeviceRotateWgBody,
    ): MobileTrustedDeviceRotateWgResponse

    @retrofit2.http.POST("mobile-devices/transfer/start")
    suspend fun startTransfer(
        @retrofit2.http.Body body: MobileDeviceTransferStartBody,
    ): MobileDeviceTransferResponse

    @retrofit2.http.POST("mobile-devices/transfer/{transferId}/confirm-old")
    suspend fun confirmOldDeviceTransfer(
        @retrofit2.http.Path("transferId") transferId: String,
        @retrofit2.http.Body body: MobileDeviceTransferOldConfirmBody,
    ): MobileDeviceTransferResponse

    @retrofit2.http.POST("mobile-devices/transfer/{transferId}/confirm-email")
    suspend fun confirmTransferEmail(
        @retrofit2.http.Path("transferId") transferId: String,
        @retrofit2.http.Body body: MobileDeviceTransferEmailConfirmBody,
    ): MobileDeviceTransferResponse

    @retrofit2.http.POST("mobile-devices/transfer/{transferId}/complete")
    suspend fun completeTransfer(
        @retrofit2.http.Path("transferId") transferId: String,
        @retrofit2.http.Body body: MobileDeviceTransferCompleteBody,
    ): MobileDeviceTransferCompleteResponse
}
