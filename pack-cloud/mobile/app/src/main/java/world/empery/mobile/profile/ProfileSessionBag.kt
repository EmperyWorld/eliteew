/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Profile tab session bag: uiState, tunnel/OTA/trusted-device mutable fields,
 * and common helpers for W1 C4 composition controllers.
 *
 * Invariants:
 * - Controllers mutate ProfileUiState only via this bag's uiState.
 * - Public API remains on ProfileTabViewModel for shell/ProfileScreen stability.
 *
 * Related:
 * - ProfileTabViewModel, ProfileOtaUpdateController, ProfileTrustedDeviceController,
 *   ProfilePrivateTunnelController, ProfileSupportDiagnosticsController
 */
package world.empery.mobile.profile

import android.app.Application
import feature.profile.AppUpdateUiState
import feature.profile.MobileApkInstaller
import feature.profile.MobileAppUpdateRepository
import feature.profile.PrivateTunnelConnectionModeUi
import feature.profile.ProfileUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import world.empery.mobile.di.AppContainer
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.tunnel.MobilePrivateTunnelManager
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore
import java.net.URI

class ProfileSessionBag(
    val scope: CoroutineScope,
    val application: Application,
    val container: AppContainer,
    val uiState: MutableStateFlow<ProfileUiState>,
    val restartAppEvents: MutableSharedFlow<Unit>,
    val hasSession: () -> Boolean,
    val privateTunnelManager: MobilePrivateTunnelManager,
    val updateRepository: MobileAppUpdateRepository,
    val trustedDeviceKeyStore: MobileTrustedDeviceKeyStore,
    val activeConnectionMode: MobileConnectionMode,
) {
    var pendingTrustedDeviceSync: Boolean = false
    var lastPrivateTunnelNetworkDeferred: Boolean = false
    val trustedDeviceOpMutex: Mutex = Mutex()
    var trustedDeviceStateRevision: Int = 0
    var oneClickInstallPending: Boolean = false
    var otaEnqueuedWatchWorkId: String? = null

    fun bumpTrustedDeviceRevision() {
        trustedDeviceStateRevision += 1
    }

    fun trustedDeviceRevisionStale(revisionAtStart: Int): Boolean =
        revisionAtStart != trustedDeviceStateRevision

    fun shouldDeferNetworkForPrivateTunnel(): Boolean =
        MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
            application,
            privateTunnelManager,
        )

    fun resolveApiHostLabel(): String =
        runCatching { URI(container.apiBaseUrl.trim()).host?.trim().orEmpty() }
            .getOrDefault("")
            .ifBlank {
                container.apiBaseUrl
                    .trim()
                    .removePrefix("https://")
                    .removePrefix("http://")
                    .trimEnd('/')
            }

    private var restartAlreadyRequested: Boolean = false

    fun requestAppRestart() {
        // One cold-restart per process; duplicate sync/clear emissions must not exitProcess-loop.
        if (restartAlreadyRequested) return
        restartAlreadyRequested = true
        restartAppEvents.tryEmit(Unit)
    }

    fun revertToPublicConnectionMode() {
        MobileConnectionModeStore.write(application, MobileConnectionMode.PUBLIC_STABLE)
        uiState.update {
            it.copy(
                privateTunnel =
                    it.privateTunnel.copy(
                        connectionMode = PrivateTunnelConnectionModeUi.PUBLIC_STABLE,
                        restartRequired = false,
                    ),
            )
        }
    }

    fun initialProfileUiState(): ProfileUiState {
        val ctx = application
        return ProfileUiState(
            appUpdate =
                AppUpdateUiState(
                    installedVersionCode = MobileApkInstaller.installedVersionCode(ctx),
                    installedVersionName = MobileApkInstaller.installedVersionName(ctx),
                ),
        )
    }

    companion object {
        const val TAG = "ProfileTabViewModel"
        const val OTA_ENQUEUED_STALL_MS = 45_000L
    }
}
