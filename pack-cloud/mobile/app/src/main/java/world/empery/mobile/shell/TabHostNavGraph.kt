/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated tab NavHost host: wires root-tab / UGS / friends / profile route
 * clusters. Destination bodies live in TabHostNav*Routes siblings (Hardened residual).
 *
 * Invariants:
 * - Deeplink `tab=notifications` opens RootTab.Notifications (W4 U6); nested UGS/friends unchanged.
 * - Route strings for nested UGS/friends paths must stay identical to pre-split TabHostCoordinator.
 * - Public [TabHostAuthenticatedNav] signature preserved for MainActivity / TabHost chrome.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostNavUgsRoutes.kt, TabHostNavRootTabRoutes.kt, TabHostNavFriendsRoutes.kt,
 *   TabHostNavProfileRoutes.kt, TabHostCoordinator.kt, TabHostChrome.kt,
 *   MobileBackStackPolicy.kt, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0
 */
package world.empery.mobile

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import feature.profile.MobileColorMode
import feature.profile.MobileUiScale
import feature.profile.MobileUiStyle
import okhttp3.OkHttpClient
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.shell.MobileShellContentFrame
import world.empery.mobile.tabs.DesktopHubTabViewModel
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel
import world.empery.mobile.tabs.UgsHubTabViewModel

@Composable
fun TabHostAuthenticatedNav(
    navController: NavHostController,
    chrome: TabHostChromeState,
    shell: MobileShellUiState,
    mainVm: MainViewModel,
    feedVm: FeedTabViewModel,
    notificationsVm: NotificationsTabViewModel,
    profileVm: ProfileTabViewModel,
    friendsVm: FriendsTabViewModel,
    desktopHubVm: DesktopHubTabViewModel,
    ugsVm: UgsHubTabViewModel,
    feedState: feature.feed.FeedUiState,
    notificationsState: feature.notifications.NotificationCenterUiState,
    profileState: feature.profile.ProfileUiState,
    friendsState: feature.friends.FriendsUiState,
    desktopHubState: feature.desktop.DesktopHubUiState,
    ugsState: feature.ugs.UgsHubUiState,
    chatState: feature.chat.ChatUiState,
    socketLifecycle: SocketLifecycleState,
    apiRootUrl: String,
    feedAuthorizedHttpClient: OkHttpClient,
    privateTunnelBootstrapBlocked: Boolean,
    postNotificationsGranted: Boolean,
    reduceMotion: Boolean,
    mobileUiStyle: MobileUiStyle,
    mobileColorMode: MobileColorMode,
    mobileUiScale: MobileUiScale,
    chatVisualStyle: ChatVisualStyle,
    chatTypography: ChatTypographySettings,
    onMobileUiStyleChange: (MobileUiStyle) -> Unit,
    onMobileColorModeChange: (MobileColorMode) -> Unit,
    onMobileUiScaleChange: (MobileUiScale) -> Unit,
    onChatVisualStyleChange: (ChatVisualStyle) -> Unit,
    onChatTypographyChange: (ChatTypographySettings) -> Unit,
    onLogoutRequest: () -> Unit,
    onOpenUrl: (String) -> Unit,
    onStartPrivateTunnel: () -> Unit,
    requestNotificationPermission: () -> Unit,
    mobileProfileSync: feature.profile.MobileProfileSync,
) {
    val context = LocalContext.current
    val mobileApp = context.applicationContext as MobileApp
    MobileShellContentFrame {
        NavHost(
            navController = navController,
            startDestination = chrome.shellStartDestination,
            modifier = Modifier.fillMaxSize(),
        ) {
            tabHostUgsRoutes(
                navController = navController,
                context = context,
                mobileApp = mobileApp,
                ugsVm = ugsVm,
                desktopHubVm = desktopHubVm,
                ugsState = ugsState,
                desktopHubState = desktopHubState,
                apiRootUrl = apiRootUrl,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                onOpenUrl = onOpenUrl,
            )
            tabHostRootTabRoutes(
                navController = navController,
                context = context,
                chrome = chrome,
                mainVm = mainVm,
                feedVm = feedVm,
                notificationsVm = notificationsVm,
                feedState = feedState,
                notificationsState = notificationsState,
                chatState = chatState,
                profileState = profileState,
                apiRootUrl = apiRootUrl,
                feedAuthorizedHttpClient = feedAuthorizedHttpClient,
            )
            tabHostFriendsRoutes(
                navController = navController,
                chrome = chrome,
                friendsVm = friendsVm,
                friendsState = friendsState,
            )
            tabHostProfileRoutes(
                navController = navController,
                context = context,
                mobileApp = mobileApp,
                chrome = chrome,
                shell = shell,
                mainVm = mainVm,
                profileVm = profileVm,
                friendsVm = friendsVm,
                profileState = profileState,
                socketLifecycle = socketLifecycle,
                postNotificationsGranted = postNotificationsGranted,
                reduceMotion = reduceMotion,
                mobileUiStyle = mobileUiStyle,
                mobileColorMode = mobileColorMode,
                mobileUiScale = mobileUiScale,
                chatVisualStyle = chatVisualStyle,
                chatTypography = chatTypography,
                onMobileUiStyleChange = onMobileUiStyleChange,
                onMobileColorModeChange = onMobileColorModeChange,
                onMobileUiScaleChange = onMobileUiScaleChange,
                onChatVisualStyleChange = onChatVisualStyleChange,
                onChatTypographyChange = onChatTypographyChange,
                onLogoutRequest = onLogoutRequest,
                onOpenUrl = onOpenUrl,
                onStartPrivateTunnel = onStartPrivateTunnel,
                requestNotificationPermission = requestNotificationPermission,
                mobileProfileSync = mobileProfileSync,
            )
        }
    }
}
