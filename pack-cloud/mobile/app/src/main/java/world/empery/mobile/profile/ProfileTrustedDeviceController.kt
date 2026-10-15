/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Trusted-device binding sync, bind/revoke/rotate WG, local snapshot (W1 C4).
 *
 * Invariants:
 * - Mutates ProfileUiState only via ProfileSessionBag.uiState.
 * - Public API remains delegated from ProfileTabViewModel for shell/ProfileScreen stability.
 * - Local-only clear when the server list is empty must not run while local WG/material
 *   is still present (avoids web/mobile bind desync after a fake unbind).
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
import feature.profile.TrustedDeviceBindingUiState
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.tunnel.MobilePrivateTunnelNetworkGuardInterceptor
import world.empery.mobile.tunnel.MobilePrivateTunnelSnapshot
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus
import world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore
import world.empery.mobile.trusteddevice.MobileTrustedDeviceTunnelMetadata
import world.empery.mobile.trusteddevice.PendingWireGuardKeyPair
import world.empery.mobile.trusteddevice.TrustedDeviceBindingSync
import world.empery.mobile.trusteddevice.TrustedDeviceServerBindingAction
import world.empery.mobile.trusteddevice.TrustedDeviceServerBindingResolution
import world.empery.mobile.update.MobileAppUpdateDownloadWorker
import world.empery.mobile.update.MobileAppUpdateScheduler
import java.io.File

class ProfileTrustedDeviceController(
    private val bag: ProfileSessionBag,
) {
    private fun applyPerimeterPolicyForTrustedDevice(bound: Boolean) {
        if (bound) {
            bag.container.perimeterAccessRepository.setAutoRenewEnabled(false)
        }
    }

    fun setTrustedDevicePairingPayload(payload: String) {
        val digits = payload.filter { it.isDigit() }.take(8)
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(
                        pairingPayload = digits,
                        error = null,
                        message = null,
                    ),
            )
        }
    }

    fun setTrustedDevicePrepareGafE2ee(enabled: Boolean) {
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(prepareGafE2ee = enabled),
            )
        }
    }

    fun confirmSecureConnectionAfterBind() {
        val app = bag.application
        MobileConnectionModeStore.write(app, MobileConnectionMode.PRIVATE_TUNNEL_BETA)
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(pendingSecureConnectionConsent = false),
                privateTunnel =
                    it.privateTunnel.copy(
                        connectionMode = PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA,
                        restartRequired = false,
                    ),
            )
        }
        bag.requestAppRestart()
    }

    fun dismissSecureConnectionConsent() {
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(pendingSecureConnectionConsent = false),
            )
        }
    }

    fun bindTrustedDevice() {
        if (!bag.hasSession()) return
        bag.scope.launch {
            val pairingInput = bag.uiState.value.trustedDeviceBinding.pairingPayload
            val prepareGaf = bag.uiState.value.trustedDeviceBinding.prepareGafE2ee
            if (pairingInput.isBlank()) {
                setTrustedDeviceBindingError(R.string.profile_trusted_device_error_missing_payload)
                return@launch
            }
            bag.uiState.update {
                it.copy(trustedDeviceBinding = it.trustedDeviceBinding.copy(isBinding = true, error = null, message = null))
            }
            try {
                val pairing = resolveTrustedDevicePairing(bag, pairingInput)
                val material =
                    bag.trustedDeviceKeyStore.buildBindMaterial(
                        challengeNonce = pairing.challengeNonce,
                        prepareGafE2ee = prepareGaf,
                    )
                val response =
                    bag.container.mobileTrustedDeviceApi.bindDevice(
                        MobileTrustedDeviceBindBody(
                            challengeId = pairing.challengeId,
                            pairingCode = pairing.pairingCode,
                            stableDeviceId = material.stableDeviceId,
                            deviceLabel = defaultTrustedDeviceLabel(),
                            devicePublicKey = material.devicePublicKey,
                            devicePublicKeyAlgorithm = material.devicePublicKeyAlgorithm,
                            signedChallenge = material.signedChallenge,
                            wgPublicKey = material.wgPublicKey,
                            gafPublicKey = material.gafPublicKey,
                            gafPublicKeyAlgorithm = material.gafPublicKeyAlgorithm,
                            capabilities = material.capabilities,
                            metadata =
                                mapOf(
                                    "source" to "mobile_profile_security",
                                    "prepare_gaf_e2ee" to prepareGaf,
                                ),
                        ),
                    )
                val tunnel = response.tunnel
                val tunnelMetadata =
                    MobileTrustedDeviceTunnelMetadata(
                        interfaceAddress = tunnel.interfaceAddress?.trim().orEmpty(),
                        dns = tunnel.dns?.trim().orEmpty(),
                        allowedIps = tunnel.allowedIps?.trim().orEmpty(),
                        endpoint = tunnel.endpoint?.trim().orEmpty(),
                        serverPublicKey = tunnel.serverPublicKey?.trim().orEmpty(),
                        persistentKeepalive = tunnel.persistentKeepalive ?: 25,
                        mtu = tunnel.mtu ?: 1280,
                    )
                if (
                    tunnelMetadata.interfaceAddress.isBlank() ||
                    tunnelMetadata.dns.isBlank() ||
                    tunnelMetadata.allowedIps.isBlank() ||
                    tunnelMetadata.endpoint.isBlank() ||
                    tunnelMetadata.serverPublicKey.isBlank()
                ) {
                    applyServerBoundFromDevice(
                        device = response.device,
                        message =
                            bag.application.getString(
                                R.string.profile_trusted_device_error_tunnel_missing,
                            ),
                    )
                    return@launch
                }
                val wgConfig = bag.trustedDeviceKeyStore.buildWireGuardConfig(tunnelMetadata)
                bag.privateTunnelManager.importConfig(wgConfig)
                bag.bumpTrustedDeviceRevision()
                applyServerBoundFromDevice(
                    device = response.device,
                    message =
                        bag.application.getString(
                            R.string.profile_trusted_device_success,
                            response.device.deviceLabel.ifBlank { defaultTrustedDeviceLabel() },
                        ),
                    offerSecureConnectionConsent = true,
                )
            } catch (err: SecurityException) {
                MobileTelemetry.reportError(err, "trusted-device binding auth required")
                setTrustedDeviceBindingError(R.string.profile_trusted_device_error_auth)
            } catch (err: HttpException) {
                MobileTelemetry.reportError(err, "trusted-device binding http failed")
                when (err.code()) {
                    404 ->
                        setTrustedDeviceBindingError(R.string.profile_trusted_device_error_code_expired)
                    401 ->
                        setTrustedDeviceBindingError(R.string.profile_trusted_device_error_invalid_code)
                    else ->
                        setTrustedDeviceBindingError(
                            err.message()?.takeIf { it.isNotBlank() }
                                ?: bag.application.getString(
                                    R.string.profile_trusted_device_error_invalid_payload,
                                ),
                        )
                }
            } catch (err: Exception) {
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "trusted-device binding failed")
                setTrustedDeviceBindingError(
                    err.message?.takeIf { it.isNotBlank() }
                        ?: bag.application.getString(R.string.profile_trusted_device_error_invalid_payload),
                )
            }
        }
    }

    private fun setTrustedDeviceBindingError(messageRes: Int) {
        setTrustedDeviceBindingError(bag.application.getString(messageRes))
    }

    private fun setTrustedDeviceBindingError(message: String) {
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(
                        isBinding = false,
                        isRevoking = false,
                        error = message,
                        message = null,
                    ),
            )
        }
    }

    fun syncTrustedDeviceBinding() {
        if (!bag.hasSession()) {
            publishLocalTrustedDeviceHint()
            return
        }
        if (bag.shouldDeferNetworkForPrivateTunnel()) {
            bag.pendingTrustedDeviceSync = true
            Log.i(ProfileSessionBag.TAG, "[STEP] trusted_device_sync deferred until private tunnel is connected")
            val localBound = localTrustedDeviceMaterialPresent()
            bag.uiState.update {
                it.copy(
                    trustedDeviceBinding =
                        it.trustedDeviceBinding.copy(
                            isSyncing = true,
                            serverBound = it.trustedDeviceBinding.serverBound || localBound,
                            configReceived = it.trustedDeviceBinding.configReceived || localBound,
                            error = null,
                            message =
                                bag.application.getString(
                                    R.string.profile_trusted_device_sync_wait_tunnel,
                                ),
                        ),
                )
            }
            return
        }
        bag.pendingTrustedDeviceSync = false
        bag.scope.launch {
            if (bag.uiState.value.trustedDeviceBinding.isRevoking) {
                Log.d(ProfileSessionBag.TAG, "[STEP] trusted_device_sync skipped: revoke in progress")
                return@launch
            }
            bag.trustedDeviceOpMutex.withLock {
                if (!bag.hasSession()) {
                    publishLocalTrustedDeviceHint()
                    return@withLock
                }
                if (bag.uiState.value.trustedDeviceBinding.isRevoking) {
                    Log.d(ProfileSessionBag.TAG, "[STEP] trusted_device_sync skipped: revoke in progress (locked)")
                    return@withLock
                }
                val revisionAtStart = bag.trustedDeviceStateRevision
                bag.uiState.update {
                    it.copy(
                        trustedDeviceBinding =
                            it.trustedDeviceBinding.copy(
                                isSyncing = true,
                                error = null,
                            ),
                    )
                }
                try {
                    val stableId = bag.trustedDeviceKeyStore.currentStableDeviceId()
                    val knownActiveDeviceId =
                        bag.uiState.value.trustedDeviceBinding.activeDeviceId
                            ?: bag.trustedDeviceKeyStore.readBindingSnapshot()?.activeDeviceId
                    val listItems =
                        bag.container.mobileTrustedDeviceApi
                            .listDevices(
                                cacheBust = System.currentTimeMillis(),
                                includeInactive = true,
                            )
                            .items
                    val activeCount =
                        listItems.count { item -> TrustedDeviceBindingSync.isActiveStatus(item.status) }
                    val resolution =
                        TrustedDeviceBindingSync.resolveServerBinding(
                            items = listItems,
                            localStableDeviceId = stableId,
                            hasLocalBindingMaterial = localTrustedDeviceMaterialPresent(),
                            knownActiveDeviceId = knownActiveDeviceId,
                        )
                    if (bag.trustedDeviceRevisionStale(revisionAtStart)) {
                        Log.i(
                            ProfileSessionBag.TAG,
                            "[STEP] trusted_device_sync discard stale revision active_count=$activeCount action=${resolution.action}",
                        )
                        bag.uiState.update {
                            it.copy(
                                trustedDeviceBinding =
                                    it.trustedDeviceBinding.copy(isSyncing = false),
                            )
                        }
                        return@withLock
                    }
                    Log.i(
                        ProfileSessionBag.TAG,
                        "[STEP] trusted_device_sync active_count=$activeCount stable_id=$stableId action=${resolution.action}",
                    )
                    MobileTelemetry.trackBusinessEvent(
                        "trusted_device_sync",
                        mapOf(
                            "active_count" to activeCount.toString(),
                            "action" to resolution.action.name,
                        ),
                    )
                    applyTrustedDeviceServerBindingResolution(
                        resolution = resolution,
                        message = null,
                    )
                } catch (err: Exception) {
                    if (err is CancellationException) throw err
                    val vpnNotReady =
                        err.message?.contains(
                            MobilePrivateTunnelNetworkGuardInterceptor.PRIVATE_TUNNEL_DISCONNECTED_MESSAGE,
                            ignoreCase = true,
                        ) == true
                    if (vpnNotReady && localTrustedDeviceMaterialPresent()) {
                        bag.pendingTrustedDeviceSync = true
                        Log.i(
                            ProfileSessionBag.TAG,
                            "[STEP] trusted_device_sync retry when vpn connects (local keys present)",
                        )
                        bag.uiState.update {
                            it.copy(
                                trustedDeviceBinding =
                                    it.trustedDeviceBinding.copy(
                                        isSyncing = true,
                                        serverBound = true,
                                        configReceived = true,
                                        error = null,
                                        message =
                                            bag.application.getString(
                                                R.string.profile_trusted_device_sync_wait_tunnel,
                                            ),
                                    ),
                            )
                        }
                        applyPerimeterPolicyForTrustedDevice(bound = true)
                        return@withLock
                    }
                    MobileTelemetry.reportError(err, "trusted-device sync failed")
                    Log.w(ProfileSessionBag.TAG, "[STEP] trusted_device_sync failed: ${err.message}")
                    val keepLocalBound = localTrustedDeviceMaterialPresent()
                    bag.uiState.update {
                        it.copy(
                            trustedDeviceBinding =
                                it.trustedDeviceBinding.copy(
                                    isSyncing = false,
                                    serverBound = it.trustedDeviceBinding.serverBound || keepLocalBound,
                                    configReceived = it.trustedDeviceBinding.configReceived || keepLocalBound,
                                    error =
                                        if (keepLocalBound) {
                                            null
                                        } else {
                                            err.message?.takeIf { message -> message.isNotBlank() }
                                                ?: bag.application.getString(
                                                    R.string.profile_trusted_device_sync_failed,
                                                )
                                        },
                                    message =
                                        if (keepLocalBound) {
                                            bag.application.getString(
                                                R.string.profile_trusted_device_sync_inconclusive,
                                            )
                                        } else {
                                            it.trustedDeviceBinding.message
                                        },
                                ),
                        )
                    }
                }
            }
        }
    }

    /** Called when authenticated EliteEW traffic is allowed (public mode or VPN connected). */
    fun onAuthenticatedNetworkReady() {
        if (!bag.hasSession()) return
        if (bag.uiState.value.trustedDeviceBinding.isRevoking) return
        syncTrustedDeviceBinding()
    }

    /** Re-check server binding when the Security section becomes visible. */
    fun onTrustedDeviceSectionVisible() {
        if (!bag.hasSession()) return
        syncTrustedDeviceBinding()
    }

    private suspend fun applyTrustedDeviceServerBindingResolution(
        resolution: TrustedDeviceServerBindingResolution,
        message: String?,
    ) {
        when (resolution.action) {
            TrustedDeviceServerBindingAction.APPLY_ACTIVE_DEVICE -> {
                val device = resolution.device ?: return
                applyServerBoundFromDevice(device, message)
            }
            TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING -> {
                clearLocalTrustedDeviceBindingInternal(
                    showMessage = true,
                    messageRes = R.string.profile_trusted_device_sync_revoked,
                    revertToPublicMode = true,
                    restartApp = true,
                )
            }
            TrustedDeviceServerBindingAction.CLEAR_SERVER_BINDING -> {
                bag.uiState.update {
                    it.copy(
                        trustedDeviceBinding =
                            it.trustedDeviceBinding.copy(
                                isSyncing = false,
                                serverBound = false,
                                activeDeviceId = null,
                                boundDeviceLabel = null,
                                localTunnelOnly = false,
                                message = message,
                            ),
                    )
                }
            }
            TrustedDeviceServerBindingAction.SYNC_INCONCLUSIVE -> {
                val hasLocal = localTrustedDeviceMaterialPresent()
                val snapshot = bag.trustedDeviceKeyStore.readBindingSnapshot()
                bag.uiState.update {
                    it.copy(
                        trustedDeviceBinding =
                            it.trustedDeviceBinding.copy(
                                isSyncing = false,
                                serverBound = hasLocal || it.trustedDeviceBinding.serverBound,
                                configReceived = hasLocal || it.trustedDeviceBinding.configReceived,
                                activeDeviceId =
                                    snapshot?.activeDeviceId
                                        ?: it.trustedDeviceBinding.activeDeviceId,
                                boundDeviceLabel =
                                    snapshot?.deviceLabel
                                        ?: it.trustedDeviceBinding.boundDeviceLabel,
                                message =
                                    bag.application.getString(
                                        R.string.profile_trusted_device_sync_inconclusive,
                                    ),
                                error = null,
                            ),
                    )
                }
                if (hasLocal) {
                    applyPerimeterPolicyForTrustedDevice(bound = true)
                }
            }
        }
    }

    private fun applyServerBoundFromDevice(
        device: MobileTrustedDeviceDto,
        message: String?,
        offerSecureConnectionConsent: Boolean = false,
    ) {
        if (!TrustedDeviceBindingSync.isActiveStatus(device.status)) {
            Log.w(
                ProfileSessionBag.TAG,
                "[STEP] trusted_device_sync reject non-active device status=${device.status}",
            )
            return
        }
        val label = device.deviceLabel.ifBlank { defaultTrustedDeviceLabel() }
        val shouldOfferSecureConsent =
            offerSecureConnectionConsent &&
                MobileConnectionModeStore.read(bag.application) == MobileConnectionMode.PUBLIC_STABLE
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(
                        isBinding = false,
                        isSyncing = false,
                        isRevoking = false,
                        pairingPayload = "",
                        serverBound = true,
                        configReceived = true,
                        activeDeviceId = device.id,
                        boundDeviceLabel = label,
                        localTunnelOnly = false,
                        pendingSecureConnectionConsent = shouldOfferSecureConsent,
                        message = if (shouldOfferSecureConsent) null else message,
                        error = null,
                    ),
            )
        }
        bag.trustedDeviceKeyStore.saveBindingSnapshot(
            activeDeviceId = device.id,
            deviceLabel = label,
        )
        applyPerimeterPolicyForTrustedDevice(bound = true)
        EmperyConnectionService.refreshIfRunning(bag.application)
    }

    fun revokeTrustedDevice() {
        if (!bag.hasSession()) return
        bag.scope.launch {
            bag.trustedDeviceOpMutex.withLock {
                bag.bumpTrustedDeviceRevision()
                bag.uiState.update {
                    it.copy(
                        trustedDeviceBinding =
                            it.trustedDeviceBinding.copy(
                                isRevoking = true,
                                error = null,
                                message = null,
                            ),
                    )
                }
                try {
                    val deviceId = resolveActiveTrustedDeviceIdForRevoke(bag)
                    if (deviceId.isNullOrBlank()) {
                        // Do not clear local WG while server may still hold an active row —
                        // that desync left web «Телефон» bound after a fake local unbind.
                        if (localTrustedDeviceMaterialPresent()) {
                            bag.uiState.update {
                                it.copy(
                                    trustedDeviceBinding =
                                        it.trustedDeviceBinding.copy(isRevoking = false),
                                )
                            }
                            setTrustedDeviceBindingError(
                                R.string.profile_trusted_device_revoke_server_lookup_failed,
                            )
                            return@withLock
                        }
                        clearLocalTrustedDeviceBindingInternal(
                            showMessage = true,
                            messageRes = R.string.profile_trusted_device_no_server_binding,
                        )
                        return@withLock
                    }
                    bag.container.mobileTrustedDeviceApi.revokeDevice(
                        deviceId,
                        MobileTrustedDeviceRevokeBody(reason = "user_revoked_from_mobile_profile"),
                    )
                    bag.bumpTrustedDeviceRevision()
                    clearLocalTrustedDeviceBindingInternal(
                        showMessage = true,
                        messageRes = R.string.profile_trusted_device_revoked,
                        revertToPublicMode = true,
                        restartApp = true,
                    )
                } catch (err: Exception) {
                    if (err is CancellationException) throw err
                    MobileTelemetry.reportError(err, "trusted-device revoke failed")
                    bag.uiState.update {
                        it.copy(
                            trustedDeviceBinding =
                                it.trustedDeviceBinding.copy(isRevoking = false),
                        )
                    }
                    setTrustedDeviceBindingError(
                        err.message?.takeIf { it.isNotBlank() }
                            ?: bag.application.getString(R.string.profile_trusted_device_revoke_failed),
                    )
                }
            }
        }
    }

    /**
     * Rotate WireGuard keypair via API, then import the new config.
     * Fail-closed: committed local WG keys and previous tunnel config stay until import succeeds.
     */
    fun rotateTrustedDeviceWireGuard() {
        if (!bag.hasSession()) return
        bag.scope.launch {
            bag.trustedDeviceOpMutex.withLock {
                val ctx = bag.application
                bag.uiState.update {
                    it.copy(
                        trustedDeviceBinding =
                            it.trustedDeviceBinding.copy(error = null, message = null),
                    )
                }
                val deviceId = resolveActiveTrustedDeviceIdForRevoke(bag)
                if (deviceId.isNullOrBlank()) {
                    setTrustedDeviceBindingError(R.string.profile_trusted_device_no_server_binding)
                    return@withLock
                }
                val pending: PendingWireGuardKeyPair =
                    bag.trustedDeviceKeyStore.generateWireGuardKeyPairForRotation()
                try {
                    val response =
                        bag.container.mobileTrustedDeviceApi.rotateWgKey(
                            deviceId,
                            MobileTrustedDeviceRotateWgBody(wgPublicKey = pending.publicKey),
                        )
                    val tunnelMetadata =
                        tunnelMetadataFromDevice(response.device)
                            ?: run {
                                // Fall back to list payload if rotate response omits tunnel fields.
                                val listed =
                                    bag.container.mobileTrustedDeviceApi
                                        .listDevices(System.currentTimeMillis())
                                        .items
                                        .firstOrNull { item -> item.id.trim() == deviceId }
                                tunnelMetadataFromDevice(listed)
                            }
                    if (tunnelMetadata == null) {
                        setTrustedDeviceBindingError(R.string.profile_trusted_device_rotate_tunnel_missing)
                        return@withLock
                    }
                    val wgConfig =
                        MobileTrustedDeviceKeyStore.buildWireGuardConfig(
                            privateKey = pending.privateKey,
                            metadata = tunnelMetadata,
                        )
                    bag.privateTunnelManager.importConfig(wgConfig)
                    if (bag.privateTunnelManager.state.value.status == MobilePrivateTunnelStatus.ERROR) {
                        setTrustedDeviceBindingError(
                            bag.privateTunnelManager.state.value.error
                                ?: ctx.getString(R.string.profile_trusted_device_rotate_failed),
                        )
                        return@withLock
                    }
                    bag.trustedDeviceKeyStore.commitWireGuardKeyPair(pending)
                    bag.bumpTrustedDeviceRevision()
                    val shouldRestartTunnel =
                        bag.privateTunnelManager.state.value.status == MobilePrivateTunnelStatus.CONNECTED ||
                            MobileConnectionModeStore.read(ctx) == MobileConnectionMode.PRIVATE_TUNNEL_BETA
                    if (shouldRestartTunnel) {
                        runCatching { bag.privateTunnelManager.stop() }
                        bag.privateTunnelManager.start()
                    }
                    bag.uiState.update {
                        it.copy(
                            trustedDeviceBinding =
                                it.trustedDeviceBinding.copy(
                                    configReceived = true,
                                    message = ctx.getString(R.string.profile_trusted_device_rotate_success),
                                    error = null,
                                ),
                        )
                    }
                } catch (err: Exception) {
                    if (err is CancellationException) throw err
                    MobileTelemetry.reportError(err, "trusted-device rotate-wg failed")
                    setTrustedDeviceBindingError(
                        err.message?.takeIf { it.isNotBlank() }
                            ?: ctx.getString(R.string.profile_trusted_device_rotate_failed),
                    )
                }
            }
        }
    }

    fun clearLocalTrustedDeviceBinding() {
        bag.scope.launch {
            clearLocalTrustedDeviceBindingInternal(
                showMessage = true,
                messageRes = R.string.profile_trusted_device_local_cleared,
            )
        }
    }

    fun restoreLocalBindingSnapshot() {
        if (!bag.hasSession()) return
        if (!localTrustedDeviceMaterialPresent()) return
        val snapshot = bag.trustedDeviceKeyStore.readBindingSnapshot() ?: return
        Log.i(
            ProfileSessionBag.TAG,
            "[STEP] trusted_device_restore local snapshot device_id=${snapshot.activeDeviceId}",
        )
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(
                        serverBound = false,
                        configReceived = true,
                        activeDeviceId = snapshot.activeDeviceId,
                        boundDeviceLabel = snapshot.deviceLabel,
                        localTunnelOnly = false,
                        isSyncing = true,
                        error = null,
                    ),
            )
        }
        applyPerimeterPolicyForTrustedDevice(bound = false)
    }

    fun publishLocalTrustedDeviceHint() {
        val localOnly = localTrustedDeviceMaterialPresent()
        bag.uiState.update {
            it.copy(
                trustedDeviceBinding =
                    it.trustedDeviceBinding.copy(
                        serverBound = false,
                        activeDeviceId = null,
                        localTunnelOnly = localOnly,
                        boundDeviceLabel = if (localOnly) it.trustedDeviceBinding.boundDeviceLabel else null,
                        isSyncing = false,
                    ),
            )
        }
    }

    private fun localTrustedDeviceMaterialPresent(): Boolean =
        bag.trustedDeviceKeyStore.capability().wireGuardKeyPresent ||
            bag.uiState.value.privateTunnel.configImported

    private suspend fun clearLocalTrustedDeviceBindingInternal(
        showMessage: Boolean = false,
        messageRes: Int = R.string.profile_trusted_device_revoked,
        revertToPublicMode: Boolean = false,
        restartApp: Boolean = false,
    ) {
        runCatching { bag.privateTunnelManager.stop() }
        bag.privateTunnelManager.clearConfig()
        bag.trustedDeviceKeyStore.clearEphemeralBindingMaterial()
        if (revertToPublicMode) {
            bag.revertToPublicConnectionMode()
        }
        val ctx = bag.application
        bag.uiState.update { state ->
            state.copy(
                trustedDeviceBinding =
                    TrustedDeviceBindingUiState(
                        prepareGafE2ee = state.trustedDeviceBinding.prepareGafE2ee,
                        message = if (showMessage) ctx.getString(messageRes) else null,
                    ),
            )
        }
        if (restartApp) {
            bag.requestAppRestart()
        }
        EmperyConnectionService.refreshIfRunning(ctx)
    }

}
