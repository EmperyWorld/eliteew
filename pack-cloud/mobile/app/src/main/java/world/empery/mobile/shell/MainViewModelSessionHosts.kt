/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Host-interface implementations that wire MainViewModel shell state into
 * Chat / SSO / Perimeter / GAF composition controllers (W1 MainViewModel shrink).
 *
 * Invariants:
 * - Hosts only bridge; domain work stays in the respective controllers/facades.
 *
 * Related:
 * - MainViewModel, ChatSessionController, SsoAuthSessionController,
 *   PerimeterTunnelSessionFacade, GafVideoCallCoordinator
 */
package world.empery.mobile.shell

import android.app.Application
import kotlinx.coroutines.flow.MutableStateFlow
import world.empery.mobile.AppRuntimeConfig
import world.empery.mobile.MainUiState
import world.empery.mobile.MobileApp
import world.empery.mobile.chat.ChatSessionHost
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.session.SsoAuthSessionHost
import world.empery.mobile.shell.realtime.RealtimeSessionHost
import world.empery.mobile.shell.videocall.GafVideoCallHost

class MainChatSessionHost(
    private val getApplication: () -> Application,
    private val resolveString: (Int) -> String,
    private val resolveStringArgs: (Int, Array<out Any>) -> String,
    private val mainStateFlow: MutableStateFlow<MainUiState>,
    private val foregroundCheck: () -> Boolean,
    private val connectRealtime: () -> Unit,
    private val refreshNotificationsAction: () -> Unit,
) : ChatSessionHost {
    override fun application(): Application = getApplication()

    override fun appString(resId: Int): String = resolveString(resId)

    override fun appString(
        resId: Int,
        vararg args: Any,
    ): String = resolveStringArgs(resId, args)

    override fun mainState(): MutableStateFlow<MainUiState> = mainStateFlow

    override fun isAppInForeground(): Boolean = foregroundCheck()

    override fun connectRealtimeIfAllowed() = connectRealtime()

    override fun refreshNotifications() = refreshNotificationsAction()
}

class MainSsoAuthSessionHost(
    private val getApplication: () -> Application,
    private val getRuntimeConfig: () -> AppRuntimeConfig,
    private val mainStateFlow: MutableStateFlow<MainUiState>,
    private val resolveString: (Int) -> String,
    private val unlockApp: () -> Unit,
    private val afterSsoLoginSucceeded: () -> Unit,
) : SsoAuthSessionHost {
    override fun application(): Application = getApplication()

    override fun runtimeConfig(): AppRuntimeConfig = getRuntimeConfig()

    override fun mainState(): MutableStateFlow<MainUiState> = mainStateFlow

    override fun appString(resId: Int): String = resolveString(resId)

    override fun markAppUnlocked() = unlockApp()

    override fun onSsoLoginSucceeded() = afterSsoLoginSucceeded()
}

class MainPerimeterTunnelSessionHost(
    private val getApplication: () -> Application,
    private val authenticatedCheck: () -> Boolean,
    private val syncFlags: () -> Unit,
    private val deferPrivateTunnelCheck: () -> Boolean,
    private val ensureConnection: () -> Unit,
    private val invalidateRealtime: () -> Unit,
    private val pauseRealtimeForCutover: () -> Unit,
    private val scheduleBackgroundSync: () -> Unit,
) : PerimeterTunnelSessionHost {
    override fun application(): Application = getApplication()

    override fun isAuthenticated(): Boolean = authenticatedCheck()

    override fun syncPerimeterCoordinatorFlags() = syncFlags()

    override fun shouldDeferAuthenticatedNetworkForPrivateTunnel(): Boolean =
        deferPrivateTunnelCheck()

    override fun ensureAuthenticatedConnection() = ensureConnection()

    override fun invalidateRealtimeBridgeAndReconnect() = invalidateRealtime()

    override fun prepareRealtimePauseForCutover() = pauseRealtimeForCutover()

    override fun scheduleBackgroundSyncIfTunnelReady() = scheduleBackgroundSync()
}

class MainGafVideoCallHost(
    private val authenticatedCheck: () -> Boolean,
    private val chatsProvider: () -> List<ChatEntity>,
    private val selectedChatIdProvider: () -> String?,
    private val foregroundCheck: () -> Boolean,
    private val getApplication: () -> Application,
    private val resolveString: (Int) -> String,
    private val resolveStringArgs: (Int, Array<out Any>) -> String,
    private val quickRefreshMs: () -> Long,
    private val callSessionChanged: () -> Unit,
    private val ensureRealtime: () -> Unit,
    private val navigateChatTab: () -> Unit,
    private val openChatAction: (String) -> Unit,
    private val scheduleRefresh: (Long) -> Unit,
    private val pauseMedia: () -> Unit,
) : GafVideoCallHost {
    override fun isAuthenticated(): Boolean = authenticatedCheck()

    override fun currentChats(): List<ChatEntity> = chatsProvider()

    override fun selectedChatId(): String? = selectedChatIdProvider()

    override fun isAppInForeground(): Boolean = foregroundCheck()

    override fun application(): Application = getApplication()

    override fun string(resId: Int): String = resolveString(resId)

    override fun string(
        resId: Int,
        vararg args: Any,
    ): String = resolveStringArgs(resId, args)

    override fun chatQuickRefreshMs(): Long = quickRefreshMs()

    override fun onCallSessionChanged() = callSessionChanged()

    override fun ensureRealtimeConnected() = ensureRealtime()

    override fun navigateToChatTab() = navigateChatTab()

    override fun openChat(chatId: String) = openChatAction(chatId)

    override fun scheduleChatRefresh(delayMs: Long) = scheduleRefresh(delayMs)

    override fun pauseMediaForGafCall() = pauseMedia()
}

/** Factory helpers keep MainViewModel property init readable. */
object MainViewModelSessionHosts {
    fun chat(
        getApplication: () -> Application,
        resolveString: (Int) -> String,
        resolveStringArgs: (Int, Array<out Any>) -> String,
        mainStateFlow: MutableStateFlow<MainUiState>,
        realtime: () -> RealtimeSessionHost,
        refreshNotificationsAction: () -> Unit,
    ): ChatSessionHost =
        MainChatSessionHost(
            getApplication = getApplication,
            resolveString = resolveString,
            resolveStringArgs = resolveStringArgs,
            mainStateFlow = mainStateFlow,
            foregroundCheck = { realtime().appInForeground },
            connectRealtime = { realtime().connectIfAllowed() },
            refreshNotificationsAction = refreshNotificationsAction,
        )

    fun sso(
        getApplication: () -> Application,
        getRuntimeConfig: () -> AppRuntimeConfig,
        mainStateFlow: MutableStateFlow<MainUiState>,
        resolveString: (Int) -> String,
        unlockApp: () -> Unit,
        afterSsoLoginSucceeded: () -> Unit,
    ): SsoAuthSessionHost =
        MainSsoAuthSessionHost(
            getApplication = getApplication,
            getRuntimeConfig = getRuntimeConfig,
            mainStateFlow = mainStateFlow,
            resolveString = resolveString,
            unlockApp = unlockApp,
            afterSsoLoginSucceeded = afterSsoLoginSucceeded,
        )

    fun perimeter(
        getApplication: () -> Application,
        authenticatedCheck: () -> Boolean,
        syncFlags: () -> Unit,
        deferPrivateTunnelCheck: () -> Boolean,
        ensureConnection: () -> Unit,
        invalidateRealtime: () -> Unit,
        pauseRealtimeForCutover: () -> Unit,
        scheduleBackgroundSync: () -> Unit,
    ): PerimeterTunnelSessionHost =
        MainPerimeterTunnelSessionHost(
            getApplication = getApplication,
            authenticatedCheck = authenticatedCheck,
            syncFlags = syncFlags,
            deferPrivateTunnelCheck = deferPrivateTunnelCheck,
            ensureConnection = ensureConnection,
            invalidateRealtime = invalidateRealtime,
            pauseRealtimeForCutover = pauseRealtimeForCutover,
            scheduleBackgroundSync = scheduleBackgroundSync,
        )

    fun scheduleBackgroundSyncDefault(getApplication: () -> Application): () -> Unit =
        {
            (getApplication() as MobileApp).scheduleBackgroundSync()
        }
}
