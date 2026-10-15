/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin tab-host facade: shellNavigation apply + deeplink fan-out into tab ViewModels.
 * Chrome lives in TabHostChrome; NavHost graph in TabHostNavGraph (W1 slice #4).
 *
 * Invariants:
 * - Deeplink / route contracts unchanged (MobileDeepLinks + MobileBackStackPolicy).
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostChrome.kt, TabHostNavGraph.kt, TabHostNav*Routes.kt, TabHostNavSupport.kt,
 *   MobileBackStackPolicy.kt, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0
 */
package world.empery.mobile

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import kotlinx.coroutines.flow.collectLatest
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.tabs.DesktopHubTabViewModel
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel

@Composable
fun TabHostShellNavigationEffect(
    navController: NavHostController,
    mainVm: MainViewModel,
    feedVm: FeedTabViewModel,
    friendsVm: FriendsTabViewModel,
    notificationsVm: NotificationsTabViewModel,
    profileVm: ProfileTabViewModel,
    desktopHubVm: DesktopHubTabViewModel,
) {
    LaunchedEffect(navController, mainVm, feedVm, friendsVm, notificationsVm, profileVm, desktopHubVm) {
        mainVm.shellNavigation.collectLatest { intent ->
            if (intent.tabRoute == "feed") {
                feedVm.handleDeepLink(intent.ewDeskPostId)
            } else if (intent.tabRoute == "friends") {
                friendsVm.handleDeepLink(
                    friendRequestId = intent.friendRequestId,
                    friendUserId = intent.friendUserId,
                    focus = intent.friendsFocus,
                    socialHubInboxItemId = intent.socialHubInboxItemId,
                )
            } else if (intent.tabRoute == "notifications") {
                notificationsVm.handleDeepLink(intent.notificationId)
            } else if (intent.tabRoute == "chat") {
                intent.chatId?.let { chatId ->
                    mainVm.refreshChats()
                    mainVm.openChat(chatId)
                }
            } else if (intent.tabRoute == "profile") {
                profileVm.handleDeepLink(intent.profileSection)
            } else if (intent.tabRoute == "ugs" && intent.nestedRoute == "ugs/desktop") {
                desktopHubVm.handleDeepLink(intent.desktopHubSection)
            }
            MobileBackStackPolicy.applyShellNavigationIntent(navController, intent)
        }
    }
}
