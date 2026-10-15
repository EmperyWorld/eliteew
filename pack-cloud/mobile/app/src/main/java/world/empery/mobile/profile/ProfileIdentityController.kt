/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile identity: refresh, privacy, avatar upload/preview (W1 C4).
 *
 * Invariants:
 * - Mutates ProfileUiState only via ProfileSessionBag.uiState.
 * - Public API remains delegated from ProfileTabViewModel for shell/ProfileScreen stability.
 * - Tunnel-deferred refresh hydrates Room cache so Profile is not empty while Secure Connection restores.
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
import feature.profile.MobileProfileLocalStore
import feature.profile.VideoCallTarget
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

class ProfileIdentityController(
    private val bag: ProfileSessionBag,
    private val checkForUpdatesIfStale: () -> Unit,
    private val checkForUpdates: () -> Unit,
    private val syncTrustedDeviceBinding: () -> Unit,
    private val checkPerimeterAccess: () -> Unit,
) {
    fun handleDeepLink(rawSection: String?) = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        val category = resolveProfileCategoryFromSection(rawSection) ?: return@launch
        bag.uiState.update { it.copy(expandCategoryId = category) }
        if (category == ProfileCategoryId.UPDATES) {
            checkForUpdatesIfStale()
        }
    }

    fun consumeExpandCategory() {
        bag.uiState.update { it.copy(expandCategoryId = null) }
    }

    fun uploadAvatar(uri: Uri) =
        bag.scope.launch {
            if (!bag.hasSession()) return@launch
            if (bag.uiState.value.isAvatarUploading) return@launch
            bag.uiState.update { it.copy(isAvatarUploading = true, avatarUploadError = null) }
            runCatching { bag.container.profileRepository.uploadAvatar(uri) }
                .onSuccess { profile ->
                    bag.uiState.update {
                        it.copy(
                            profile = profile,
                            isAvatarUploading = false,
                            avatarUploadError = null,
                        )
                    }
                }
                .onFailure { err ->
                    if (err is CancellationException) throw err
                    MobileTelemetry.reportError(err, "profileAvatar.upload failed")
                    bag.uiState.update {
                        it.copy(
                            isAvatarUploading = false,
                            avatarUploadError = err.message,
                        )
                    }
                }
        }

    fun refresh() = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        if (bag.shouldDeferNetworkForPrivateTunnel()) {
            hydrateFromCache()
            syncTrustedDeviceBinding()
            return@launch
        }
        if (bag.uiState.value.isLoading) return@launch
        bag.uiState.update { it.copy(isLoading = true, error = null) }
        runCatching {
            val profile = bag.container.profileRepository.refresh()
            val privacy = bag.container.profileRepository.getPrivacy()
            val circles =
                runCatching { bag.container.profileRepository.loadPrivacyCircles() }
                    .onFailure { error ->
                        if (error is CancellationException) throw error
                        MobileTelemetry.reportError(error, "refreshProfile.circles failed")
                    }
                    .getOrDefault(emptyList())
            Triple(profile, privacy, circles)
        }
            .onSuccess { (profile, privacy, circles) ->
                bag.uiState.update {
                    it.copy(
                        profile = profile,
                        privacy = privacy,
                        privacyCircles = circles,
                        isLoading = false,
                        error = null,
                        privacyError = null,
                    )
                }
                checkForUpdates()
                checkPerimeterAccess()
                if (!bag.uiState.value.trustedDeviceBinding.isRevoking) {
                    syncTrustedDeviceBinding()
                }
            }
            .onFailure { err ->
                if (err is CancellationException || err.cause is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshProfile failed")
                val cached = bag.container.profileRepository.loadFromCache()
                bag.uiState.update {
                    it.copy(profile = cached, isLoading = false, error = err.message)
                }
            }
    }

    /**
     * Show last known profile while private tunnel blocks network refresh.
     * Does not set isLoading — shell may still show secure-connection restoring.
     */
    fun hydrateFromCache() =
        bag.scope.launch {
            if (!bag.hasSession()) return@launch
            if (bag.uiState.value.profile != null) return@launch
            val cached =
                runCatching { bag.container.profileRepository.loadFromCache() }
                    .onFailure { err ->
                        if (err is CancellationException) throw err
                        MobileTelemetry.reportError(err, "hydrateProfileFromCache failed")
                    }
                    .getOrNull()
                    ?: return@launch
            bag.uiState.update { state ->
                if (state.profile != null) {
                    state
                } else {
                    state.copy(profile = cached, error = null)
                }
            }
        }

    fun savePrivacy(
        discoverability: String,
        avatarVisibility: String,
        avatarCircleId: String?,
        fullNameVisibility: String,
        fullNameCircleId: String?,
        bioVisibility: String,
        bioCircleId: String?,
    ) = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        if (bag.uiState.value.isPrivacySaving) return@launch
        bag.uiState.update { it.copy(isPrivacySaving = true, privacyError = null) }
        runCatching {
            bag.container.profileRepository.updatePrivacy(
                discoverability = discoverability,
                avatarVisibility = avatarVisibility,
                avatarCircleId = avatarCircleId,
                fullNameVisibility = fullNameVisibility,
                fullNameCircleId = fullNameCircleId,
                bioVisibility = bioVisibility,
                bioCircleId = bioCircleId,
            )
        }
            .onSuccess { privacy ->
                bag.uiState.update {
                    it.copy(
                        privacy = privacy,
                        isPrivacySaving = false,
                        privacyError = null,
                    )
                }
            }
            .onFailure { err ->
                if (err is CancellationException || err.cause is CancellationException) throw err
                MobileTelemetry.reportError(err, "profilePrivacy.save failed")
                bag.uiState.update {
                    it.copy(
                        isPrivacySaving = false,
                        privacyError = err.message,
                    )
                }
            }
    }

    fun setCallTarget(
        callTarget: String,
        onApplied: () -> Unit = {},
    ) = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        if (bag.uiState.value.isCallTargetSaving) return@launch
        val next = VideoCallTarget.normalize(callTarget)
        val previous = MobileProfileLocalStore.getCallTarget(bag.application)
        if (next == previous) return@launch
        MobileProfileLocalStore.setCallTarget(bag.application, next)
        onApplied()
        bag.uiState.update { it.copy(isCallTargetSaving = true, callTargetError = null) }
        runCatching {
            bag.container.mobileProfileRepository.updateCallTarget(next)
        }
            .onSuccess { saved ->
                MobileProfileLocalStore.setCallTarget(bag.application, saved)
                bag.uiState.update {
                    it.copy(isCallTargetSaving = false, callTargetError = null)
                }
                onApplied()
            }
            .onFailure { err ->
                if (err is CancellationException || err.cause is CancellationException) throw err
                MobileTelemetry.reportError(err, "profileCallTarget.save failed")
                MobileProfileLocalStore.setCallTarget(bag.application, previous)
                bag.uiState.update {
                    it.copy(
                        isCallTargetSaving = false,
                        callTargetError = err.message,
                    )
                }
                onApplied()
            }
    }

    fun stageAvatarPreview(uri: Uri) = bag.scope.launch {
        val ctx = bag.application
        runCatching {
            val draft = buildProfileAvatarUploadDraft(ctx, uri)
            val prepared = prepareMobileImageUploadWebp(ctx, draft)
            val sizeLabel = prepared.sizeBytes?.let { "WebP ${it / 1024} KB" }
            bag.uiState.update {
                it.copy(
                    avatarPreviewUri = prepared.uri,
                    avatarCompressInfo = sizeLabel,
                )
            }
            prepared.tempFile?.delete()
        }.onFailure { err ->
            bag.uiState.update { it.copy(avatarUploadError = err.message) }
        }
    }

    fun confirmAvatarUpload() {
        val uri = bag.uiState.value.avatarPreviewUri ?: return
        bag.uiState.update { it.copy(avatarPreviewUri = null, avatarCompressInfo = null) }
        uploadAvatar(uri)
    }

    fun dismissAvatarPreview() {
        bag.uiState.update { it.copy(avatarPreviewUri = null, avatarCompressInfo = null) }
    }

    fun removeAvatar() = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        runCatching { bag.container.profileRepository.deleteAvatar() }
            .onSuccess { profile ->
                bag.uiState.update { it.copy(profile = profile, avatarPreviewUri = null, avatarCompressInfo = null) }
            }
            .onFailure { err ->
                bag.uiState.update { it.copy(avatarUploadError = err.message) }
            }
    }

}
