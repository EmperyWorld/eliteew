/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile support bundle, storage/cache clears, device session diagnostics (W1 C4).
 *
 * Invariants:
 * - Mutates ProfileUiState only via ProfileSessionBag.uiState.
 * - Public API remains delegated from ProfileTabViewModel for shell/ProfileScreen stability.
 *
 * Related:
 * - ProfileTabViewModel, ProfileSessionBag, feature.profile.ProfileScreen
 */
package world.empery.mobile.profile

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.work.WorkInfo
import androidx.work.WorkManager
import coil.imageLoader
import feature.profile.ApkSha256VerificationState
import feature.profile.MobileApkInstaller
import feature.profile.MobileAppUpdateDownloadSupport
import feature.profile.MobileAppUpdateMessages
import feature.profile.MobileAppUpdatePrefs
import feature.profile.PartialApkDownload
import feature.profile.PrivateTunnelConnectionModeUi
import feature.profile.PrivateTunnelUiState
import feature.profile.PrivateTunnelUiStatus
import feature.profile.ProfileCategoryId
import feature.profile.ProfileDeviceSessionUiState
import feature.profile.ProfileStorageUiState
import feature.profile.ProfileSupportBundleInput
import feature.profile.ProfileUiState
import feature.profile.R
import feature.profile.buildProfileAvatarUploadDraft
import feature.profile.buildProfileSupportBundle
import feature.profile.canShowOtaInstallButton
import feature.profile.measureProfileLocalStorage
import feature.profile.parseDownloadedApkVersionCode
import feature.profile.readBuildFlavor
import feature.profile.resolveApkSha256VerificationState
import feature.profile.resolveOtaReleaseNotesForProfile
import feature.profile.resolveOtaUpdateUrgency
import feature.profile.resolveProfileCategoryFromSection
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.HttpException
import world.empery.mobile.MobileApp
import world.empery.mobile.connection.EmperyConnectionService
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaStreamCachePrefs
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.network.api.MobilePairingChallengeResolveBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceBindBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceDto
import world.empery.mobile.core.network.api.MobileTrustedDeviceRevokeBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceRotateWgBody
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.tunnel.MobilePrivateTunnelSnapshot
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus
import world.empery.mobile.trusteddevice.MobileTrustedDeviceTunnelMetadata
import world.empery.mobile.trusteddevice.PendingWireGuardKeyPair
import world.empery.mobile.trusteddevice.TrustedDeviceBindingSync
import world.empery.mobile.trusteddevice.TrustedDeviceServerBindingResolution
import world.empery.mobile.update.MobileAppUpdateDownloadWorker
import world.empery.mobile.update.MobileAppUpdateScheduler
import java.io.File

class ProfileSupportDiagnosticsController(
    private val bag: ProfileSessionBag,
) {
    fun setSupportMode(enabled: Boolean) {
        bag.uiState.update { it.copy(supportMode = enabled) }
        refreshSupportBundle()
    }

    fun refreshStorageStats() = bag.scope.launch {
        if (bag.shouldDeferNetworkForPrivateTunnel()) return@launch
        val ctx = bag.application
        val feedEstimate = runCatching {
            bag.container.feedRepository.loadFromCache().sumOf { (it.title.length + it.body.length).toLong() * 2L }
        }.getOrDefault(0L)
        val baseStats = measureProfileLocalStorage(ctx, feedEstimate, bag.updateRepository)
        val wifiOnly = EmperyMediaStreamCachePrefs.isWifiOnlyPrefetch(ctx)
        val stats =
            baseStats.copy(
                streamCacheBytes = EmperyMediaPlayerHolder.streamCacheUsedBytes(),
                streamCacheTrackCount = EmperyMediaPlayerHolder.streamCacheTrackCount(),
            )
        bag.uiState.update {
            it.copy(
                storage =
                    ProfileStorageUiState(
                        stats = stats,
                        isClearing = it.storage.isClearing,
                        wifiOnlyStreamPrefetch = wifiOnly,
                    ),
            )
        }
    }

    fun setStreamCacheWifiOnly(enabled: Boolean) {
        val ctx = bag.application
        EmperyMediaStreamCachePrefs.setWifiOnlyPrefetch(ctx, enabled)
        bag.uiState.update { it.copy(storage = it.storage.copy(wifiOnlyStreamPrefetch = enabled)) }
    }

    fun clearStreamCache() = bag.scope.launch {
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = true)) }
        runCatching { EmperyMediaPlayerHolder.clearStreamCache() }
        refreshStorageStats()
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = false)) }
    }

    @OptIn(coil.annotation.ExperimentalCoilApi::class)
    fun clearMediaCache() = bag.scope.launch {
        val ctx = bag.application
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = true)) }
        runCatching {
            ctx.imageLoader.diskCache?.clear()
            ctx.imageLoader.memoryCache?.clear()
            bag.container.chatRepository.clearAttachmentDiskCache()
        }
        refreshStorageStats()
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = false)) }
    }

    fun clearOfflineCache() = bag.scope.launch {
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = true)) }
        runCatching { bag.container.clearSessionScopedCache() }
        refreshStorageStats()
        bag.uiState.update { it.copy(storage = it.storage.copy(isClearing = false)) }
    }

    fun refreshSupportBundle() {
        val ctx = bag.application
        val profile = bag.uiState.value.profile
        val input = ProfileSupportBundleInput(
            appVersionName = MobileApkInstaller.installedVersionName(ctx),
            appVersionCode = MobileApkInstaller.installedVersionCode(ctx),
            buildFlavor = readBuildFlavor(ctx),
            apiHost = bag.resolveApiHostLabel(),
            sessionSignedIn = bag.uiState.value.sessionHealth.signedIn,
            accessTokenExpiresAtEpochSec = bag.uiState.value.sessionHealth.accessTokenExpiresAtEpochSec,
            socketState = bag.uiState.value.sessionHealth.socketLifecycle,
            fcmRegistered = !feature.notifications.MobileNotificationPreferences.readCachedFcmToken(ctx).isNullOrBlank(),
            userId = profile?.id,
            supportMode = bag.uiState.value.supportMode,
        )
        bag.uiState.update { it.copy(supportBundleText = buildProfileSupportBundle(input)) }
    }

    fun refreshDeviceSession(socketLifecycle: world.empery.mobile.core.network.SocketLifecycleState) {
        val ctx = bag.application
        bag.uiState.update {
            it.copy(
                deviceSession = ProfileDeviceSessionUiState(
                    appVersionName = MobileApkInstaller.installedVersionName(ctx),
                    appVersionCode = MobileApkInstaller.installedVersionCode(ctx),
                    buildFlavor = readBuildFlavor(ctx),
                    apiHost = bag.resolveApiHostLabel(),
                    socketState = socketLifecycle,
                    fcmRegistered = !feature.notifications.MobileNotificationPreferences.readCachedFcmToken(ctx).isNullOrBlank(),
                ),
            )
        }
    }

    fun exportSupportBundle() {
        val ctx = bag.application
        val text = bag.uiState.value.supportBundleText
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(Intent.createChooser(intent, "Support bundle").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun submitSupportReportToServer() {
        if (!bag.hasSession()) {
            bag.uiState.update {
                it.copy(supportReportFeedback = bag.application.getString(R.string.profile_support_bundle_submit_no_session))
            }
            return
        }
        val bundleText = bag.uiState.value.supportBundleText.trim()
        if (bundleText.isBlank()) return
        val ctx = bag.application
        bag.scope.launch {
            bag.uiState.update { it.copy(supportReportSubmitting = true, supportReportFeedback = null) }
            runCatching {
                val response =
                    bag.updateRepository.submitSupportReport(
                        bundleText = bundleText,
                        category = "general",
                        appVersionName = MobileApkInstaller.installedVersionName(ctx),
                        appVersionCode = MobileApkInstaller.installedVersionCode(ctx),
                        deviceModel = Build.MODEL,
                    )
                ctx.getString(R.string.profile_support_bundle_submit_success, response.reportId)
            }.onSuccess { message ->
                bag.uiState.update {
                    it.copy(
                        supportReportSubmitting = false,
                        supportReportFeedback = message,
                    )
                }
            }.onFailure { err ->
                bag.uiState.update {
                    it.copy(
                        supportReportSubmitting = false,
                        supportReportFeedback = err.message ?: ctx.getString(R.string.profile_support_bundle_submit_failed),
                    )
                }
            }
        }
    }

}
