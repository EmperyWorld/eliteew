package world.empery.mobile.shell

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.ShellNavigationIntent
import world.empery.mobile.coerceFriendsNestedRoute

/**
 * Main-shell navigation intents (tabs + optional nested routes/EWDesk post UUID) emitted
 * from SSO/deeplinks/notifications. Consumed by [androidx.navigation.compose.NavHost]
 * in [world.empery.mobile.MainActivity].
 */
class SessionNavigationBridge(
    private val scope: CoroutineScope,
) {
    private var lastIntent: ShellNavigationIntent? = null
    private var lastIntentEpochMs: Long = 0L
    private val dedupeWindowMs = 1_500L

    private val _routes = MutableSharedFlow<ShellNavigationIntent>(
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    val routes: SharedFlow<ShellNavigationIntent> = _routes.asSharedFlow()

    fun request(intent: ShellNavigationIntent) {
        val now = System.currentTimeMillis()
        if (lastIntent == intent && now - lastIntentEpochMs < dedupeWindowMs) return
        lastIntent = intent
        lastIntentEpochMs = now
        val tab = intent.tabRoute.trim().lowercase()
        val normalized = MobileDeepLinks.shellNavigationIntentForIncomingTab(tab) ?: return
        val merged = mergeShellNavigationIntent(base = normalized, overlay = intent)
        scope.launch {
            _routes.emit(merged)
        }
    }

    internal fun mergeShellNavigationIntent(
        base: ShellNavigationIntent,
        overlay: ShellNavigationIntent,
    ): ShellNavigationIntent {
        val tab = base.tabRoute
        val friendsNav = MobileDeepLinks.isFriendsNavIncomingTab(tab)
        val notificationsNav = tab == "notifications"
        val chatNav = tab == "chat"
        val profileNav = tab == "profile"
        val ugsNav = tab == "ugs"
        val nestedRoute = overlay.nestedRoute ?: base.nestedRoute
        val preservedNested =
            when {
                ugsNav -> nestedRoute
                friendsNav ->
                    nestedRoute?.takeIf {
                        coerceFriendsNestedRoute(it) != null || it.startsWith("friends/")
                    }
                else -> null
            }
        return base.copy(
            ewDeskPostId =
                MobileDeepLinks.coerceEwDeskPostId(overlay.ewDeskPostId)?.takeIf { tab == "feed" },
            friendRequestId = overlay.friendRequestId?.takeIf { friendsNav },
            friendUserId = overlay.friendUserId?.takeIf { friendsNav },
            friendsFocus = overlay.friendsFocus?.takeIf { friendsNav } ?: base.friendsFocus?.takeIf { friendsNav },
            notificationId = overlay.notificationId?.takeIf { notificationsNav },
            chatId = overlay.chatId?.takeIf { chatNav },
            profileSection = overlay.profileSection?.takeIf { profileNav },
            socialHubInboxItemId = overlay.socialHubInboxItemId?.takeIf { friendsNav },
            nestedRoute = preservedNested,
            desktopHubSection =
                overlay.desktopHubSection?.takeIf { ugsNav && nestedRoute == "ugs/desktop" },
        )
    }
}
