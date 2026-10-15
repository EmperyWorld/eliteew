/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends tab + nested action-center NavHost destinations for TabHostAuthenticatedNav.
 * Extracted from TabHostNavGraph (Hardened residual).
 *
 * Invariants:
 * - Route strings (`friends`, [FRIENDS_ACTION_CENTER_ROUTE]) stay identical to pre-split graph.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostNavGraph.kt, FriendsDeepLinkSupport.kt, MobileBackStackPolicy.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0 Hardened residual
 */
package world.empery.mobile

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Group
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import feature.friends.FriendsLiteScreen
import feature.friends.FriendsRelationshipActionCenterScreen
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.MobileShellNestedContextScaffold
import world.empery.mobile.shell.RootTab
import world.empery.mobile.tabs.FriendsTabViewModel

internal fun NavGraphBuilder.tabHostFriendsRoutes(
    navController: NavHostController,
    chrome: TabHostChromeState,
    friendsVm: FriendsTabViewModel,
    friendsState: feature.friends.FriendsUiState,
) {
    composable(RootTab.Friends.route) {
        RefreshableRoute(
            isRefreshing = friendsState.isLoading,
            onRefresh = friendsVm::refresh,
        ) {
            var newCircleName by remember { mutableStateOf("") }
            FriendsLiteScreen(
                state = friendsState,
                socialHubInbox = friendsState.socialHubInbox,
                socialHubInboxExpanded = friendsState.socialHubInboxExpanded,
                onToggleSocialHubInbox = friendsVm::toggleSocialHubInboxExpanded,
                onExpandSocialHubInbox = friendsVm::expandSocialHubInbox,
                onSocialHubInboxItemClick = friendsVm::onSocialHubInboxItemClick,
                focusedSocialHubInboxItemId = friendsState.focusedSocialHubInboxItemId,
                onFocusedSocialHubInboxItemConsumed = friendsVm::consumeFocusedSocialHubInboxItem,
                privacyPreview = friendsState.privacyPreview,
                showPrivacyWizard = friendsState.showPrivacyWizard,
                onOpenPrivacyPreview = friendsVm::showPrivacyWizard,
                onDismissPrivacyWizard = friendsVm::dismissPrivacyWizard,
                newCircleName = newCircleName,
                onNewCircleNameChange = { newCircleName = it },
                onCreateCircle = { friendsVm.createCircle(newCircleName); newCircleName = "" },
                onRenameCircle = { circle, name -> friendsVm.renameCircle(circle.id, name) },
                onDeleteCircle = { friendsVm.deleteCircle(it.id) },
                useFriendDetailScreen = friendsState.useFriendDetailScreen,
                onBackFromFriendDetail = friendsVm::dismissFriendDetail,
                onOpenFullSocialHub = chrome.openFullSocialHub,
                onOpenActionCenter = {
                    MobileBackStackPolicy.navigateNested(
                        navController,
                        FRIENDS_ACTION_CENTER_ROUTE,
                    )
                },
                onAccept = friendsVm::acceptFriendRequest,
                onReject = friendsVm::rejectFriendRequest,
                onCancelSentRequest = friendsVm::cancelFriendRequest,
                onSearchUsers = friendsVm::searchFriendUsers,
                onSendRequestToUser = friendsVm::sendFriendRequestToUser,
                onSendRequest = friendsVm::sendFriendRequest,
                onToggleFavorite = friendsVm::toggleFavorite,
                onToggleMute = friendsVm::toggleMute,
                onToggleShareActivity = friendsVm::toggleShareActivity,
                onRequestBlockToggle = friendsVm::toggleBlock,
                onReportUser = friendsVm::reportUser,
                onOpenFriendDetail = friendsVm::openFriendDetail,
                onDismissFriendDetail = friendsVm::dismissFriendDetail,
                onSaveFriendDetail = friendsVm::saveFriendDetail,
                onLoadFriendSharedContent = friendsVm::loadFriendSharedContent,
                onRetryFriendSharedContent = friendsVm::retryFriendSharedContent,
                referralInvite = friendsState.referralInvite,
                isReferralLoading = friendsState.isReferralLoading,
                referralError = friendsState.referralError,
                onRetryReferralInvite = friendsVm::loadReferralInvite,
                onRetryRefresh = friendsVm::refresh,
            )
        }
    }
    composable(FRIENDS_ACTION_CENTER_ROUTE) {
        LaunchedEffect(Unit) {
            if (friendsState.friends.isEmpty() && !friendsState.isLoading) {
                friendsVm.refresh()
            }
        }
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_friends_action_center_label),
            detail = stringResource(R.string.mobile_context_friends_action_center_detail),
            icon = Icons.Outlined.Group,
        ) {
            FriendsRelationshipActionCenterScreen(
                state = friendsState,
                socialHubInbox = friendsState.socialHubInbox,
                onOpenFriend = { friend ->
                    navController.popBackStack()
                    friendsVm.openFriendDetail(friend)
                },
                onOpenInbox = {
                    navController.popBackStack()
                    friendsVm.expandSocialHubInbox()
                },
                onOpenPrivacy = {
                    navController.popBackStack()
                    friendsVm.showPrivacyWizard()
                },
                onInboxItemClick = { item ->
                    navController.popBackStack()
                    friendsVm.onSocialHubInboxItemClick(item)
                },
                onRetry = friendsVm::refresh,
            )
        }
    }
}
