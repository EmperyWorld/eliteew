/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile tab ViewModel composition host: OTA, trusted-device, private tunnel,
 * identity, and support/diagnostics controllers (W1 C4 atomization).
 *
 * Invariants:
 * - Trusted-device UI must follow server `status=active` rows for this phone's stable_device_id only.
 * - Update download requires authenticated session (Bearer via AppContainer OkHttp).
 * - Public API surface stays on ProfileTabViewModel; domain work lives in child controllers.
 * - Profile identity hydrates from Room on init so private-tunnel defer does not blank the tab.
 *
 * Related:
 * - feature.profile.ProfileScreen, ProfileOtaUpdateController, ProfileTrustedDeviceController,
 *   ProfilePrivateTunnelController, ProfileIdentityController, ProfileSupportDiagnosticsController
 */
package world.empery.mobile.tabs

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.viewModelScope
import feature.profile.ProfileUiState
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.profile.ProfileIdentityController
import world.empery.mobile.profile.ProfileOtaUpdateController
import world.empery.mobile.profile.ProfilePrivateTunnelController
import world.empery.mobile.profile.ProfileSessionBag
import world.empery.mobile.profile.ProfileSupportDiagnosticsController
import world.empery.mobile.profile.ProfileTrustedDeviceController
import world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore
import world.empery.mobile.tunnel.MobileConnectionModeStore
import feature.profile.PrivateTunnelConnectionModeUi

class ProfileTabViewModel(
    application: Application,
) : AuthenticatedTabViewModel(application) {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()
    private val _restartAppEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val restartAppEvents: SharedFlow<Unit> = _restartAppEvents.asSharedFlow()

    private val bag =
        ProfileSessionBag(
            scope = viewModelScope,
            application = application,
            container = container,
            uiState = _uiState,
            restartAppEvents = _restartAppEvents,
            hasSession = { hasSession() },
            privateTunnelManager = container.mobilePrivateTunnelManager,
            updateRepository = container.mobileAppUpdateRepository,
            trustedDeviceKeyStore = MobileTrustedDeviceKeyStore(application.applicationContext),
            activeConnectionMode = MobileConnectionModeStore.read(application.applicationContext),
        ).also { sessionBag ->
            _uiState.value = sessionBag.initialProfileUiState()
        }

    private val ota = ProfileOtaUpdateController(bag)
    private val trustedDevice = ProfileTrustedDeviceController(bag)
    private val privateTunnel = ProfilePrivateTunnelController(bag)
    private val support = ProfileSupportDiagnosticsController(bag)
    private val identity =
        ProfileIdentityController(
            bag = bag,
            checkForUpdatesIfStale = { ota.checkForUpdatesIfStale() },
            checkForUpdates = { ota.checkForUpdates() },
            syncTrustedDeviceBinding = { trustedDevice.syncTrustedDeviceBinding() },
            checkPerimeterAccess = { privateTunnel.checkPerimeterAccess() },
        )

    init {
        ota.bootstrap()
        identity.hydrateFromCache()
        viewModelScope.launch {
            container.perimeterAccessRepository.state.collect { perimeter ->
                _uiState.update { it.copy(perimeterAccess = perimeter) }
            }
        }
        privateTunnel.wireTunnelStateCollector(
            onUnauthenticated = { trustedDevice.publishLocalTrustedDeviceHint() },
            onNetworkReadyTransition = { trustedDevice.syncTrustedDeviceBinding() },
        )
        viewModelScope.launch {
            bag.privateTunnelManager.refresh()
            bag.lastPrivateTunnelNetworkDeferred = bag.shouldDeferNetworkForPrivateTunnel()
            if (hasSession()) {
                trustedDevice.restoreLocalBindingSnapshot()
                trustedDevice.syncTrustedDeviceBinding()
            } else {
                trustedDevice.publishLocalTrustedDeviceHint()
            }
        }
        viewModelScope.launch {
            if (hasSession() && !bag.shouldDeferNetworkForPrivateTunnel()) {
                ota.checkForUpdatesIfStale()
                privateTunnel.checkPerimeterAccess()
                support.refreshStorageStats()
                support.refreshSupportBundle()
            }
        }
    }

    fun checkForUpdatesIfStale() = ota.checkForUpdatesIfStale()

    fun handleDeepLink(rawSection: String?) = identity.handleDeepLink(rawSection)

    fun consumeExpandCategory() = identity.consumeExpandCategory()

    fun checkPerimeterAccess() = privateTunnel.checkPerimeterAccess()

    fun setPerimeterAutoRenew(enabled: Boolean) = privateTunnel.setPerimeterAutoRenew(enabled)

    fun setTrustedDevicePairingPayload(payload: String) =
        trustedDevice.setTrustedDevicePairingPayload(payload)

    fun setTrustedDevicePrepareGafE2ee(enabled: Boolean) =
        trustedDevice.setTrustedDevicePrepareGafE2ee(enabled)

    fun confirmSecureConnectionAfterBind() = trustedDevice.confirmSecureConnectionAfterBind()

    fun dismissSecureConnectionConsent() = trustedDevice.dismissSecureConnectionConsent()

    fun bindTrustedDevice() = trustedDevice.bindTrustedDevice()

    fun syncTrustedDeviceBinding() = trustedDevice.syncTrustedDeviceBinding()

    fun onAuthenticatedNetworkReady() = trustedDevice.onAuthenticatedNetworkReady()

    fun onTrustedDeviceSectionVisible() = trustedDevice.onTrustedDeviceSectionVisible()

    fun revokeTrustedDevice() = trustedDevice.revokeTrustedDevice()

    fun rotateTrustedDeviceWireGuard() = trustedDevice.rotateTrustedDeviceWireGuard()

    fun clearLocalTrustedDeviceBinding() = trustedDevice.clearLocalTrustedDeviceBinding()

    fun renewPerimeterAccess() = privateTunnel.renewPerimeterAccess()

    fun privateTunnelPermissionIntent(): Intent? = privateTunnel.privateTunnelPermissionIntent()

    fun onPrivateTunnelPermissionRejected() = privateTunnel.onPrivateTunnelPermissionRejected()

    fun importPrivateTunnelConfig(rawConfig: String) =
        privateTunnel.importPrivateTunnelConfig(rawConfig)

    fun startPrivateTunnel(onCompleted: (() -> Unit)? = null) =
        privateTunnel.startPrivateTunnel(onCompleted)

    fun stopPrivateTunnel() = privateTunnel.stopPrivateTunnel()

    fun clearPrivateTunnelConfig() = privateTunnel.clearPrivateTunnelConfig()

    fun setPrivateTunnelConnectionMode(mode: PrivateTunnelConnectionModeUi) =
        privateTunnel.setPrivateTunnelConnectionMode(mode)

    fun uploadAvatar(uri: Uri) = identity.uploadAvatar(uri)

    fun refresh() = identity.refresh()

    fun savePrivacy(
        discoverability: String,
        avatarVisibility: String,
        avatarCircleId: String?,
        fullNameVisibility: String,
        fullNameCircleId: String?,
        bioVisibility: String,
        bioCircleId: String?,
    ) = identity.savePrivacy(
        discoverability = discoverability,
        avatarVisibility = avatarVisibility,
        avatarCircleId = avatarCircleId,
        fullNameVisibility = fullNameVisibility,
        fullNameCircleId = fullNameCircleId,
        bioVisibility = bioVisibility,
        bioCircleId = bioCircleId,
    )

    fun setCallTarget(
        callTarget: String,
        onApplied: () -> Unit = {},
    ) = identity.setCallTarget(callTarget, onApplied)

    fun checkForUpdates() = ota.checkForUpdates()

    fun updateAppOneClick() = ota.updateAppOneClick()

    fun handleOtaInstallAborted(retryDownload: Boolean = false) =
        ota.handleOtaInstallAborted(retryDownload)

    fun downloadUpdate() = ota.downloadUpdate()

    fun setSupportMode(enabled: Boolean) = support.setSupportMode(enabled)

    fun refreshStorageStats() = support.refreshStorageStats()

    fun setStreamCacheWifiOnly(enabled: Boolean) = support.setStreamCacheWifiOnly(enabled)

    fun clearStreamCache() = support.clearStreamCache()

    fun clearMediaCache() = support.clearMediaCache()

    fun clearOfflineCache() = support.clearOfflineCache()

    fun refreshSupportBundle() = support.refreshSupportBundle()

    fun refreshDeviceSession(socketLifecycle: SocketLifecycleState) =
        support.refreshDeviceSession(socketLifecycle)

    fun exportSupportBundle() = support.exportSupportBundle()

    fun submitSupportReportToServer() = support.submitSupportReportToServer()

    fun stageAvatarPreview(uri: Uri) = identity.stageAvatarPreview(uri)

    fun confirmAvatarUpload() = identity.confirmAvatarUpload()

    fun dismissAvatarPreview() = identity.dismissAvatarPreview()

    fun removeAvatar() = identity.removeAvatar()

    fun cancelDownload() = ota.cancelDownload()

    fun pauseDownload() = ota.pauseDownload()
}
