/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Main shell ViewModel composition host: auth/SSO, biometric gate, perimeter/tunnel
 * cutover, chat session, GAF video, realtime socket (W1 atomization).
 *
 * Invariants:
 * - User-visible errors and hints resolve via app string resources.
 * - Public API surface stays on MainViewModel; domain work lives in child controllers.
 *
 * Related:
 * - MainActivity, ChatSessionController, SsoAuthSessionController,
 *   BiometricUnlockSessionFacade, PerimeterTunnelSessionFacade, RealtimeSessionHost
 */
package world.empery.mobile

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import feature.chat.ChatAttachmentDraft
import feature.chat.ChatListFilterTab
import feature.chat.ChatUiState
import feature.desktop.PendingEmbeddedSpaDeepLink
import feature.profile.SessionHealthUiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import world.empery.mobile.chat.ChatSessionController
import world.empery.mobile.core.auth.AuthTerminationReason
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceRequest
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceResult
import world.empery.mobile.core.auth.MobileSsoLaunchPlan
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.perimeter.PerimeterAccessCoordinator
import world.empery.mobile.security.AppBiometricUnlockGate
import world.empery.mobile.security.BiometricAuthCoordinator
import world.empery.mobile.security.BiometricUnlockSessionFacade
import world.empery.mobile.session.SsoAuthSessionController
import world.empery.mobile.shell.LogoutSessionFacade
import world.empery.mobile.shell.MainGafVideoCallHost
import world.empery.mobile.shell.MainPerimeterTunnelSessionHost
import world.empery.mobile.shell.MainViewModelSessionHosts
import world.empery.mobile.shell.PerimeterTunnelSessionFacade
import world.empery.mobile.shell.SessionNavigationBridge
import world.empery.mobile.shell.ShellDeeplinkStore
import world.empery.mobile.shell.realtime.RealtimeSessionBridge
import world.empery.mobile.shell.realtime.RealtimeSessionHost
import world.empery.mobile.shell.videocall.GafVideoCallCoordinator
import world.empery.mobile.sync.MobileSyncScheduler
import world.empery.mobile.sync.MobileSyncScope
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.upgrade.MobileUpgradeSessionGate

class MainViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private fun appStr(resId: Int): String = getApplication<Application>().getString(resId)

    private fun appStr(resId: Int, vararg args: Any): String =
        getApplication<Application>().getString(resId, *args)

    private val runtimeConfig = AppRuntimeConfig.from(application.applicationContext)
    private val container: AppContainer = (application as MobileApp).container
    private val perimeterCoordinator: PerimeterAccessCoordinator =
        (application as MobileApp).perimeterAccessCoordinator

    private val deeplinkStore = ShellDeeplinkStore()
    val deeplinkRecovery = deeplinkStore.deeplinkRecovery
    val pendingEmbeddedSpaDeepLink = deeplinkStore.pendingEmbeddedSpaDeepLink

    fun requestEmbeddedSpaDeepLink(link: PendingEmbeddedSpaDeepLink) =
        deeplinkStore.requestEmbeddedSpaDeepLink(link)

    fun consumePendingEmbeddedSpaDeepLink() = deeplinkStore.consumePendingEmbeddedSpaDeepLink()

    fun consumeDeeplinkRecoveryFlag() = deeplinkStore.consumeDeeplinkRecoveryFlag()

    fun signalDeeplinkRecovery() = deeplinkStore.signalDeeplinkRecovery()

    private val biometricSession =
        BiometricUnlockSessionFacade(
            application = application,
            hasSession = { container.authRepository.hasSession() },
        )
    val isAppUnlocked: StateFlow<Boolean> = biometricSession.isAppUnlocked
    val biometricUnlockEnabled: StateFlow<Boolean> = biometricSession.biometricUnlockEnabled
    val biometricGateError: StateFlow<String?> = biometricSession.biometricGateError

    private val _state =
        MutableStateFlow(
            MainUiState(
                isAuthenticated = container.authRepository.hasSession(),
                chatState =
                    ChatUiState(
                        chatLocalFlags = container.chatRepository.loadLocalFlags(),
                        composerDrafts = container.chatRepository.loadDrafts(),
                    ),
            ),
        )
    val state: StateFlow<MainUiState> = _state.asStateFlow()

    private val _socketLifecycleState = MutableStateFlow(SocketLifecycleState.Disconnected)
    val socketLifecycleState: StateFlow<SocketLifecycleState> = _socketLifecycleState.asStateFlow()

    private val _transientAuthNetworkDeferral = MutableStateFlow(false)
    val transientAuthNetworkDeferral: StateFlow<Boolean> = _transientAuthNetworkDeferral.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    private lateinit var chatSession: ChatSessionController
    private lateinit var gafVideoCallCoordinator: GafVideoCallCoordinator
    private lateinit var logoutSession: LogoutSessionFacade

    private val realtimeBridge =
        object : RealtimeSessionBridge {
            override fun isAuthenticated(): Boolean = _state.value.isAuthenticated

            override fun shouldDeferAuthenticatedNetworkForPrivateTunnel(): Boolean =
                this@MainViewModel.shouldDeferAuthenticatedNetworkForPrivateTunnel()

            override fun onProcessForegroundBiometric(backgroundStartedAtEpochMs: Long?): Long? =
                biometricSession.onProcessForeground(backgroundStartedAtEpochMs)

            override fun syncPerimeterCoordinatorFlags(appInForeground: Boolean) {
                this@MainViewModel.syncPerimeterCoordinatorFlags(appInForeground)
            }

            override suspend fun performLogoutInternal(clearRemote: Boolean) {
                logoutSession.performLogout(clearRemote)
            }

            override fun appString(resId: Int): String = appStr(resId)
        }

    private val realtimeSession =
        RealtimeSessionHost(
            scope = viewModelScope,
            getApplication = { getApplication() },
            container = container,
            runtimeConfigBaseUrl = { runtimeConfig.baseUrl },
            perimeterCoordinator = perimeterCoordinator,
            socketLifecycleState = _socketLifecycleState,
            transientAuthNetworkDeferral = _transientAuthNetworkDeferral,
            userMessage = _userMessage,
            bridge = realtimeBridge,
            chatSession = { chatSession },
            gafVideoCall = { gafVideoCallCoordinator },
        )

    private val chatSessionHost =
        MainViewModelSessionHosts.chat(
            getApplication = { getApplication() },
            resolveString = { appStr(it) },
            resolveStringArgs = { resId, args -> appStr(resId, *args) },
            mainStateFlow = _state,
            realtime = { realtimeSession },
            refreshNotificationsAction = { refreshNotifications() },
        )

    private val ssoAuthSession =
        SsoAuthSessionController(
            viewModelScope,
            container,
            MainViewModelSessionHosts.sso(
                getApplication = { getApplication() },
                getRuntimeConfig = { runtimeConfig },
                mainStateFlow = _state,
                resolveString = { appStr(it) },
                unlockApp = { biometricSession.markAppUnlocked() },
                afterSsoLoginSucceeded = {
                    realtimeSession.clearAuthRecoveryState()
                    realtimeSession.registerTokenRefreshListener()
                    syncPerimeterCoordinatorFlags()
                    realtimeSession.ensureAuthenticatedConnection()
                },
            ),
        )

    private val perimeterTunnelSession =
        PerimeterTunnelSessionFacade(
            scope = viewModelScope,
            container = container,
            perimeterCoordinator = perimeterCoordinator,
            host =
                MainPerimeterTunnelSessionHost(
                    getApplication = { getApplication() },
                    authenticatedCheck = { _state.value.isAuthenticated },
                    syncFlags = { syncPerimeterCoordinatorFlags() },
                    deferPrivateTunnelCheck = {
                        shouldDeferAuthenticatedNetworkForPrivateTunnel()
                    },
                    ensureConnection = { realtimeSession.ensureAuthenticatedConnection() },
                    invalidateRealtime = { realtimeSession.invalidateBridgeAndReconnect() },
                    pauseRealtimeForCutover = { realtimeSession.prepareRealtimePauseForCutover() },
                    scheduleBackgroundSync =
                        MainViewModelSessionHosts.scheduleBackgroundSyncDefault { getApplication() },
                ),
        )

    private val navigationBridge = SessionNavigationBridge(viewModelScope)
    val shellNavigation = navigationBridge.routes

    val shellUiState: StateFlow<MobileShellUiState> =
        combine(
            state,
            biometricSession.isAppUnlocked,
            biometricSession.biometricUnlockEnabled,
            biometricSession.biometricGateError,
        ) { s, unlocked, bioEnabled, gateError ->
            val hw = AppBiometricUnlockGate.canAuthenticate(getApplication<Application>())
            MobileShellUiState(
                isAuthenticated = s.isAuthenticated,
                authInProgress = s.authInProgress,
                authError = s.authError,
                sessionReplaceConfirmVisible = s.sessionReplaceConfirmVisible,
                isAppUnlocked = unlocked,
                biometricUnlockEnabled = bioEnabled,
                biometricHardwareAvailable = hw,
                biometricGateError = gateError,
            )
        }
            .distinctUntilChanged()
            .stateIn(
                viewModelScope,
                SharingStarted.WhileSubscribed(5_000),
                MobileShellUiState(
                    isAuthenticated = _state.value.isAuthenticated,
                    authInProgress = _state.value.authInProgress,
                    authError = _state.value.authError,
                    sessionReplaceConfirmVisible = _state.value.sessionReplaceConfirmVisible,
                    isAppUnlocked = biometricSession.unlockedValue(),
                    biometricUnlockEnabled = biometricSession.enabledValue(),
                    biometricHardwareAvailable =
                        AppBiometricUnlockGate.canAuthenticate(getApplication()),
                    biometricGateError = biometricSession.gateErrorValue(),
                ),
            )

    val chatUiState: StateFlow<ChatUiState> =
        state
            .map { it.chatState }
            .distinctUntilChanged()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), _state.value.chatState)

    val gafVideoCallOverlay
        get() = gafVideoCallCoordinator.gafVideoCallOverlay
    val incomingGafVideoCall
        get() = gafVideoCallCoordinator.incomingGafVideoCall
    val outgoingGafVideoCall
        get() = gafVideoCallCoordinator.outgoingGafVideoCall
    val gafGroupCallPicker
        get() = gafVideoCallCoordinator.gafGroupCallPicker

    private fun shouldDeferAuthenticatedNetworkForPrivateTunnel(): Boolean =
        MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
            getApplication(),
            container.mobilePrivateTunnelManager,
        )

    init {
        container.authRepository.onSessionTerminated = { reason ->
            viewModelScope.launch {
                runCatching {
                    MobileTelemetry.trackBusinessEvent(
                        "auth_session_terminated",
                        mapOf("reason" to reason.name.lowercase()),
                    )
                }
                val messageRes =
                    when (reason) {
                        AuthTerminationReason.SessionReplaced -> R.string.auth_session_replaced_snackbar
                        AuthTerminationReason.RefreshRejected -> R.string.auth_session_refresh_rejected_snackbar
                    }
                _userMessage.emit(appStr(messageRes))
                logoutSession.performLogout(clearRemote = false)
            }
        }
        container.authRepository.onTransientRefreshNetworkError = {
            _transientAuthNetworkDeferral.value = true
        }

        chatSession = ChatSessionController(viewModelScope, container, chatSessionHost)
        gafVideoCallCoordinator =
            GafVideoCallCoordinator(
                viewModelScope,
                container,
                MainGafVideoCallHost(
                    authenticatedCheck = { _state.value.isAuthenticated },
                    chatsProvider = { _state.value.chatState.chats },
                    selectedChatIdProvider = { _state.value.chatState.selectedChatId },
                    foregroundCheck = { realtimeSession.appInForeground },
                    getApplication = { getApplication() },
                    resolveString = { appStr(it) },
                    resolveStringArgs = { resId, args -> appStr(resId, *args) },
                    quickRefreshMs = { chatSession.chatQuickRefreshMs() },
                    callSessionChanged = { realtimeSession.syncConnectionForegroundService() },
                    ensureRealtime = { realtimeSession.connectIfAllowed() },
                    navigateChatTab = { requestNavigateToRoute("chat") },
                    openChatAction = { openChat(it) },
                    scheduleRefresh = { delayMs -> chatSession.scheduleChatRefresh(delayMs) },
                    pauseMedia = {
                        runCatching { EmperyMediaPlayerHolder.controller.pauseForInterrupt() }
                    },
                ),
            )
        logoutSession =
            LogoutSessionFacade(
                getApplication = { getApplication() },
                container = container,
                mainState = _state,
                realtimeSession = { realtimeSession },
                chatSession = { chatSession },
                gafVideoCall = { gafVideoCallCoordinator },
                biometricSession = biometricSession,
                syncPerimeterCoordinatorFlags = { syncPerimeterCoordinatorFlags() },
            )

        realtimeSession.attachProcessLifecycle()
        viewModelScope.launch {
            MobileUpgradeSessionGate.awaitIfScheduled()
            if (!container.authRepository.hasSession() && _state.value.isAuthenticated) {
                logoutSession.performLogout(clearRemote = false)
            } else if (_state.value.isAuthenticated) {
                realtimeSession.ensureAuthenticatedConnection()
            }
        }
        viewModelScope.launch {
            while (true) {
                delay(5_000L)
                if (_state.value.isAuthenticated && !container.authRepository.hasSession()) {
                    logoutSession.performLogout(clearRemote = false)
                }
            }
        }
        realtimeSession.registerTokenRefreshListener()
        perimeterCoordinator.onPerimeterRenewed = {
            realtimeSession.ensureAuthenticatedConnection()
        }
        syncPerimeterCoordinatorFlags()
        perimeterTunnelSession.wirePrivateTunnelSocketHandover()
    }

    private fun syncPerimeterCoordinatorFlags(appInForeground: Boolean = realtimeSession.appInForeground) {
        perimeterTunnelSession.syncFlags(
            authenticated = _state.value.isAuthenticated,
            appInForeground = appInForeground,
        )
    }

    fun onNetworkRestored() {
        perimeterTunnelSession.onNetworkRestored(
            clearTransientAuthDeferral = { _transientAuthNetworkDeferral.value = false },
        )
        if (!_state.value.isAuthenticated) return
        if (shouldDeferAuthenticatedNetworkForPrivateTunnel()) return
        MobileSyncScheduler.enqueueImmediate(getApplication(), MobileSyncScope.LIGHT, force = true)
    }

    fun onUnderlyingNetworkChanged() = perimeterTunnelSession.onUnderlyingNetworkChanged()

    fun onActivityResumedForPerimeter() = perimeterTunnelSession.onActivityResumedForPerimeter()

    fun bindPerimeterActivityContext(context: android.content.Context) =
        perimeterTunnelSession.bindPerimeterActivityContext(context)

    fun clearPerimeterActivityContext() = perimeterTunnelSession.clearPerimeterActivityContext()

    fun handlePerimeterRenewIntent() = perimeterTunnelSession.handlePerimeterRenewIntent()

    fun requestManualPerimeterAuth() = perimeterTunnelSession.requestManualPerimeterAuth()

    fun presentIncomingGafVideoCallFromPush(
        callId: String,
        chatId: String?,
        title: String,
        autoAccept: Boolean = false,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
    ) {
        gafVideoCallCoordinator.presentIncomingFromPush(
            callId = callId,
            chatId = chatId,
            title = title,
            autoAccept = autoAccept,
            callerUserId = callerUserId,
            callerAvatarUrl = callerAvatarUrl,
        )
    }

    fun requestNavigateToRoute(route: String) {
        val intent = MobileDeepLinks.shellNavigationIntentForIncomingTab(route) ?: return
        navigationBridge.request(intent)
    }

    fun pendingMutationCount(): Int = chatSession.pendingMutationCount()

    fun prepareForPrivateTunnelNetworkCutover() =
        perimeterTunnelSession.prepareForPrivateTunnelNetworkCutover()

    fun resumeRealtimeAfterPrivateTunnelNetworkCutover() =
        perimeterTunnelSession.resumeRealtimeAfterPrivateTunnelNetworkCutover()

    fun requestShellNavigation(intent: ShellNavigationIntent) =
        viewModelScope.launch {
            navigationBridge.request(intent)
        }

    fun prepareSsoLoginLaunchPlan(): MobileSsoLaunchPlan = ssoAuthSession.prepareSsoLoginLaunchPlan()

    fun resolveSsoLoginAfterBrowserChoice(
        request: MobileSsoBrowserChoiceRequest,
        result: MobileSsoBrowserChoiceResult,
    ): Intent? = ssoAuthSession.resolveSsoLoginAfterBrowserChoice(request, result)

    fun dismissSessionReplaceConfirm() = ssoAuthSession.dismissSessionReplaceConfirm()

    fun confirmSessionReplaceAndPrepareLogin(): MobileSsoLaunchPlan =
        ssoAuthSession.confirmSessionReplaceAndPrepareLogin()

    fun onSsoLoginCanceled() = ssoAuthSession.onSsoLoginCanceled()

    fun handleAppAuthCallbackResult(intent: Intent?) = ssoAuthSession.handleAppAuthCallbackResult(intent)

    fun completeSsoLoginFromCallback(code: String?, state: String?) =
        ssoAuthSession.completeSsoLoginFromCallback(code, state)

    fun clearAuthError() = ssoAuthSession.clearAuthError()

    fun setAuthError(message: String) = ssoAuthSession.setAuthError(message)

    fun logout() {
        viewModelScope.launch { logoutSession.performLogout(clearRemote = true) }
    }

    fun markAppUnlocked() = biometricSession.markAppUnlocked()

    fun handleBiometricAuthEffect(effect: BiometricAuthCoordinator.Effect) =
        biometricSession.handleBiometricAuthEffect(effect)

    fun setBiometricUnlockEnabled(enabled: Boolean) =
        biometricSession.setBiometricUnlockEnabled(enabled)

    fun sessionHealthState(profileDisplayName: String?, profileEmail: String?): SessionHealthUiState =
        SessionHealthUiState(
            signedIn = _state.value.isAuthenticated,
            displayName = profileDisplayName,
            email = profileEmail,
            accessTokenExpiresAtEpochSec = container.authRepository.accessTokenExpiryEpochSeconds(),
            socketLifecycle = _socketLifecycleState.value,
        )

    fun refreshNotifications() =
        viewModelScope.launch {
            if (!_state.value.isAuthenticated) return@launch
            runCatching {
                container.notificationRepository.refresh()
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshNotifications failed")
            }
        }

    fun refreshChats(): Job = chatSession.refreshChats()

    fun startGafVideoCallFromChat(chatId: String) = gafVideoCallCoordinator.startFromChat(chatId)

    fun openGafGroupVideoCallPicker(chatId: String) = gafVideoCallCoordinator.openGroupPicker(chatId)

    fun dismissGafGroupVideoCallPicker() = gafVideoCallCoordinator.dismissGroupPicker()

    fun startGafGroupVideoCallFromChat(
        chatId: String,
        additionalParticipantIds: List<String>,
    ) = gafVideoCallCoordinator.startGroupFromChat(chatId, additionalParticipantIds)

    fun returnToActiveGafVideoCall() = gafVideoCallCoordinator.returnToActiveCall()

    fun onGafMeetCallEnded(callId: String, chatId: String?, durationSeconds: Long) {
        gafVideoCallCoordinator.onMeetCallEnded(callId, chatId, durationSeconds)
    }

    fun endActiveGafVideoCall() = gafVideoCallCoordinator.endActive()

    fun cancelOutgoingGafVideoCall() = gafVideoCallCoordinator.cancelOutgoing()

    fun acceptIncomingGafVideoCall() = gafVideoCallCoordinator.acceptIncoming()

    fun declineIncomingGafVideoCall() = gafVideoCallCoordinator.declineIncoming()

    fun openChat(chatId: String) = chatSession.openChat(chatId)

    fun setChatFilter(query: String) = chatSession.setChatFilter(query)

    fun closeChat() = chatSession.closeChat()

    fun proposeChatE2ee() = chatSession.proposeChatE2ee()

    fun acceptChatE2ee() = chatSession.acceptChatE2ee()

    fun declineChatE2ee() = chatSession.declineChatE2ee()

    fun disableChatE2ee() = chatSession.disableChatE2ee()

    fun setChatListFilterTab(tab: ChatListFilterTab) = chatSession.setChatListFilterTab(tab)

    fun setChatDraft(chatId: String, draft: String) = chatSession.setChatDraft(chatId, draft)

    fun setChatUserSearchQuery(query: String) = chatSession.setChatUserSearchQuery(query)

    fun searchChatUsers(): Job = chatSession.searchChatUsers()

    fun openOrCreateChatByUsername(username: String) = chatSession.openOrCreateChatByUsername(username)

    fun loadOlderMessages(): Job = chatSession.loadOlderMessages()

    fun toggleChatPinned(chatId: String) = chatSession.toggleChatPinned(chatId)

    fun toggleChatMuted(chatId: String) = chatSession.toggleChatMuted(chatId)

    fun toggleChatArchived(chatId: String) = chatSession.toggleChatArchived(chatId)

    fun startReplyToMessage(messageId: String) = chatSession.startReplyToMessage(messageId)

    fun cancelReplyToMessage() = chatSession.cancelReplyToMessage()

    fun startEditMessage(messageId: String) = chatSession.startEditMessage(messageId)

    fun cancelEditMessage() = chatSession.cancelEditMessage()

    fun deleteChatMessage(messageId: String, forMeOnly: Boolean = false): Job =
        chatSession.deleteChatMessage(messageId, forMeOnly)

    fun clearCurrentChatHistory(): Job = chatSession.clearCurrentChatHistory()

    fun archiveCurrentChat(): Job = chatSession.archiveCurrentChat()

    fun deleteCurrentChat(): Job = chatSession.deleteCurrentChat()

    fun sendMessage(
        chatId: String,
        message: String,
        attachments: List<ChatAttachmentDraft>,
    ): Job = chatSession.sendMessage(chatId, message, attachments)

    fun retryFailedMessage(messageId: String): Job = chatSession.retryFailedMessage(messageId)

    fun cancelPendingMessage(messageId: String): Job = chatSession.cancelPendingMessage(messageId)

    fun openAttachment(chatId: String, messageId: String, fileName: String?): Job =
        chatSession.openAttachment(chatId, messageId, fileName)

    fun downloadAttachmentToDevice(chatId: String, messageId: String, fileName: String?): Job =
        chatSession.downloadAttachmentToDevice(chatId, messageId, fileName)

    fun loadAttachmentPreview(chatId: String, messageId: String, fileName: String?): Job =
        chatSession.loadAttachmentPreview(chatId, messageId, fileName)

    fun scheduleChatImagePreviewPreloads() = chatSession.scheduleChatImagePreviewPreloads()

    override fun onCleared() {
        perimeterTunnelSession.clearPrivateTunnelSocketHandover()
        chatSession.clearOnCleared()
        gafVideoCallCoordinator.resetOnLogout()
        realtimeSession.onCleared()
        super.onCleared()
    }
}
