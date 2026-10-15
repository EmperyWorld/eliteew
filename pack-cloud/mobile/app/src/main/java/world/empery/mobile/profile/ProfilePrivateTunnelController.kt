/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Private tunnel VPN import/start/stop and perimeter access probes (W1 C4).
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

class ProfilePrivateTunnelController(
    private val bag: ProfileSessionBag,
) {
    fun checkPerimeterAccess() = bag.scope.launch {
        if (bag.shouldDeferNetworkForPrivateTunnel()) return@launch
        runCatching { (bag.application as MobileApp).perimeterAccessCoordinator.probeNow() }
            .onFailure { err ->
                MobileTelemetry.reportError(err, "perimeter access probe failed")
            }
    }

    fun setPerimeterAutoRenew(enabled: Boolean) {
        if (enabled && bag.uiState.value.trustedDeviceBinding.serverBound) return
        bag.container.perimeterAccessRepository.setAutoRenewEnabled(enabled)
    }

    fun renewPerimeterAccess() {
        (bag.application as MobileApp).perimeterAccessCoordinator.onManualRenewRequested()
    }

    fun privateTunnelPermissionIntent(): Intent? = bag.privateTunnelManager.vpnPermissionIntent()

    fun onPrivateTunnelPermissionRejected() {
        bag.privateTunnelManager.onVpnPermissionRejected()
    }

    fun importPrivateTunnelConfig(rawConfig: String) {
        bag.scope.launch {
            runCatching { bag.privateTunnelManager.importConfig(rawConfig) }
                .onFailure { err ->
                    bag.uiState.update {
                        it.copy(
                            privateTunnel =
                                it.privateTunnel.copy(
                                    status = PrivateTunnelUiStatus.ERROR,
                                    error = err.message ?: err.javaClass.simpleName,
                                ),
                        )
                    }
                }
        }
    }

    fun startPrivateTunnel(onCompleted: (() -> Unit)? = null) {
        bag.scope.launch {
            try {
                bag.privateTunnelManager.start()
            } finally {
                if (bag.privateTunnelManager.state.value.status == MobilePrivateTunnelStatus.CONNECTED) {
                    onCompleted?.invoke()
                }
            }
        }
    }

    fun stopPrivateTunnel() {
        bag.scope.launch {
            bag.privateTunnelManager.stop()
        }
    }

    fun clearPrivateTunnelConfig() {
        bag.scope.launch {
            bag.privateTunnelManager.clearConfig()
        }
    }

    fun setPrivateTunnelConnectionMode(mode: PrivateTunnelConnectionModeUi) {
        val app = bag.application
        MobileConnectionModeStore.write(app, mode.toConnectionMode())
        bag.uiState.update {
            it.copy(
                privateTunnel =
                    it.privateTunnel.copy(
                        connectionMode = mode,
                        restartRequired = mode.toConnectionMode() != bag.activeConnectionMode,
                    ),
            )
        }
    }



    fun wireTunnelStateCollector(
        onUnauthenticated: () -> Unit,
        onNetworkReadyTransition: () -> Unit,
    ) {
        bag.scope.launch {
            bag.privateTunnelManager.state.collect { tunnel ->
                val selectedMode = MobileConnectionModeStore.read(bag.application)
                bag.uiState.update {
                    it.copy(
                        privateTunnel =
                            tunnel.toProfileUiState(
                                selectedMode = selectedMode,
                                activeConnectionMode = bag.activeConnectionMode,
                            ),
                    )
                }
                if (!bag.hasSession()) {
                    onUnauthenticated()
                    return@collect
                }
                val networkDeferred =
                    MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
                        bag.application,
                        tunnel.status,
                    )
                if (bag.lastPrivateTunnelNetworkDeferred && !networkDeferred) {
                    Log.i(ProfileSessionBag.TAG, "[STEP] trusted_device_sync tunnel network ready")
                    onNetworkReadyTransition()
                }
                bag.lastPrivateTunnelNetworkDeferred = networkDeferred
            }
        }
    }
}

private fun MobilePrivateTunnelSnapshot.toProfileUiState(
    selectedMode: MobileConnectionMode,
    activeConnectionMode: MobileConnectionMode,
): PrivateTunnelUiState {
    return PrivateTunnelUiState(
        status =
            when (status) {
                MobilePrivateTunnelStatus.NOT_CONFIGURED -> PrivateTunnelUiStatus.NOT_CONFIGURED
                MobilePrivateTunnelStatus.DISCONNECTED -> PrivateTunnelUiStatus.DISCONNECTED
                MobilePrivateTunnelStatus.PERMISSION_REQUIRED -> PrivateTunnelUiStatus.PERMISSION_REQUIRED
                MobilePrivateTunnelStatus.VPN_CONFLICT -> PrivateTunnelUiStatus.VPN_CONFLICT
                MobilePrivateTunnelStatus.CONNECTING -> PrivateTunnelUiStatus.CONNECTING
                MobilePrivateTunnelStatus.WAITING_EDGE -> PrivateTunnelUiStatus.WAITING_EDGE
                MobilePrivateTunnelStatus.RETRYING -> PrivateTunnelUiStatus.RETRYING
                MobilePrivateTunnelStatus.CONNECTED -> PrivateTunnelUiStatus.CONNECTED
                MobilePrivateTunnelStatus.STOPPING -> PrivateTunnelUiStatus.STOPPING
                MobilePrivateTunnelStatus.ERROR -> PrivateTunnelUiStatus.ERROR
            },
        connectionMode = selectedMode.toProfileMode(),
        restartRequired = selectedMode != activeConnectionMode,
        configImported = configImported,
        peerAddress = peerAddress,
        endpoint = endpoint,
        dns = dns,
        message = message,
        error = error,
    )
}

private fun MobileConnectionMode.toProfileMode(): PrivateTunnelConnectionModeUi =
    when (this) {
        MobileConnectionMode.PUBLIC_STABLE -> PrivateTunnelConnectionModeUi.PUBLIC_STABLE
        MobileConnectionMode.PRIVATE_TUNNEL_BETA -> PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA
    }

private fun PrivateTunnelConnectionModeUi.toConnectionMode(): MobileConnectionMode =
    when (this) {
        PrivateTunnelConnectionModeUi.PUBLIC_STABLE -> MobileConnectionMode.PUBLIC_STABLE
        PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA -> MobileConnectionMode.PRIVATE_TUNNEL_BETA
    }
