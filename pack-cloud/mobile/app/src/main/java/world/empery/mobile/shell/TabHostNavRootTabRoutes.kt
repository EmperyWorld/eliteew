/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Root-tab NavHost destinations for Feed, Notifications, and Chat under
 * TabHostAuthenticatedNav. Extracted from TabHostNavGraph (Hardened residual).
 *
 * Invariants:
 * - Route strings and deeplink tab contracts stay identical to pre-split TabHostNavGraph.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostNavGraph.kt, MobileBackStackPolicy.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0 Hardened residual
 */
package world.empery.mobile

import android.content.Context
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import feature.chat.ChatLiteScreen
import feature.feed.EwDeskFeedScreen
import feature.notifications.NotificationCenterScreen
import feature.notifications.openNotificationSettings
import okhttp3.OkHttpClient
import world.empery.mobile.core.ui.MobileInstalledAppRoutes
import world.empery.mobile.education.MobileEducationCardId
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.MobileFeatureShellPreferences
import world.empery.mobile.shell.RootTab
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel

internal fun NavGraphBuilder.tabHostRootTabRoutes(
    navController: NavHostController,
    context: Context,
    chrome: TabHostChromeState,
    mainVm: MainViewModel,
    feedVm: FeedTabViewModel,
    notificationsVm: NotificationsTabViewModel,
    feedState: feature.feed.FeedUiState,
    notificationsState: feature.notifications.NotificationCenterUiState,
    chatState: feature.chat.ChatUiState,
    profileState: feature.profile.ProfileUiState,
    apiRootUrl: String,
    feedAuthorizedHttpClient: OkHttpClient,
) {
    composable(RootTab.Feed.route) {
        RefreshableRoute(
            isRefreshing = feedState.isLoading,
            onRefresh = feedVm::refresh,
        ) {
            EwDeskFeedScreen(
                state = feedState,
                focusPostId = feedState.focusPostId,
                onFeedFocusConsumed = feedVm::clearFeedFocus,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = feedAuthorizedHttpClient,
                onRefresh = feedVm::refresh,
                onOpenNotifications = {
                    MobileBackStackPolicy.navigateBottomTab(
                        navController,
                        RootTab.Notifications.route,
                    )
                },
                onOpenFullEwDesk = chrome.openFullEwDesk,
                onOpenApp = { appId ->
                    MobileBackStackPolicy.navigateBottomTab(
                        navController,
                        MobileInstalledAppRoutes.bottomTabRouteForStoreAppId(appId),
                    )
                },
                unreadNotificationCount = chrome.notificationsUnreadCount,
                onTopicFilterChange = feedVm::setTopicFilter,
                onToggleSavedPost = feedVm::toggleSavedPost,
                onOpenFullPost = feedVm::openFullPost,
                onDismissFullPost = feedVm::dismissFullPost,
                onDismissOtaChangelog = { feedVm.markOtaChangelogSeen(feedState.otaChangelogVersion ?: "") },
                topContent = {
                    MobileEducationCardsRail(
                        cards = chrome.educationCards,
                        onAction = { cardId ->
                            when (cardId) {
                                MobileEducationCardId.PROFILE_COMPLETE ->
                                    MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Profile.route)
                                MobileEducationCardId.NOTIFICATIONS_ENABLE ->
                                    openNotificationSettings(context)
                                MobileEducationCardId.FIRST_FRIEND ->
                                    MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Friends.route)
                                MobileEducationCardId.FIRST_CHAT ->
                                    MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Chat.route)
                                MobileEducationCardId.FIRST_UGS_GENERATION ->
                                    MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Ugs.route)
                            }
                        },
                        onDismiss = { cardId ->
                            chrome.setDismissedEducationCardIds(
                                MobileFeatureShellPreferences.dismissEducationCard(
                                    context.applicationContext,
                                    cardId.name,
                                ).mapNotNull { raw ->
                                    runCatching { MobileEducationCardId.valueOf(raw) }.getOrNull()
                                }.toSet(),
                            )
                        },
                    )
                },
            )
        }
    }
    composable(RootTab.Notifications.route) {
        RefreshableRoute(
            isRefreshing = notificationsState.isLoading,
            onRefresh = notificationsVm::refresh,
        ) {
            NotificationCenterScreen(
                state = notificationsState,
                onRefresh = notificationsVm::refresh,
                onBack = {
                    MobileBackStackPolicy.navigateBottomTab(
                        navController,
                        RootTab.Feed.route,
                    )
                },
                onFilterChange = notificationsVm::setFilter,
                onItemClick = notificationsVm::openDetail,
                onMarkAllRead = notificationsVm::markAllRead,
                onUndoMarkAllRead = notificationsVm::undoMarkAllRead,
                onDismissDetail = notificationsVm::dismissDetail,
                onDetailCta = { cta ->
                    notificationsVm.onDetailCta(cta)
                    when (cta) {
                        feature.notifications.NotificationCta.OpenFriends ->
                            MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Friends.route)
                        feature.notifications.NotificationCta.OpenChat ->
                            MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Chat.route)
                        feature.notifications.NotificationCta.OpenUgs ->
                            MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Ugs.route)
                        feature.notifications.NotificationCta.OpenDesktop -> {
                            MobileBackStackPolicy.navigateBottomTab(
                                navController,
                                RootTab.Ugs.route,
                            )
                            MobileBackStackPolicy.navigateNested(
                                navController,
                                "ugs/desktop",
                            )
                        }
                        else -> Unit
                    }
                },
                onFocusConsumed = notificationsVm::clearFocus,
                showContextStrip = false,
                showBackNavigation = false,
            )
        }
    }
    composable(RootTab.Chat.route) {
        RefreshableRoute(
            isRefreshing = chatState.isLoading,
            onRefresh = mainVm::refreshChats,
        ) {
            ChatLiteScreen(
                state = chatState,
                onOpenChat = mainVm::openChat,
                onCloseChat = mainVm::closeChat,
                onLoadOlderMessages = mainVm::loadOlderMessages,
                onChatFilterChange = mainVm::setChatFilter,
                onFilterTabChange = mainVm::setChatListFilterTab,
                onTogglePinned = mainVm::toggleChatPinned,
                onToggleMuted = mainVm::toggleChatMuted,
                onToggleArchived = mainVm::toggleChatArchived,
                onSetUserSearchQuery = mainVm::setChatUserSearchQuery,
                onSearchUsers = mainVm::searchChatUsers,
                onOpenOrCreateChatByUsername = mainVm::openOrCreateChatByUsername,
                onSetDraft = mainVm::setChatDraft,
                onSendMessage = mainVm::sendMessage,
                onRetryMessage = mainVm::retryFailedMessage,
                onCancelMessage = mainVm::cancelPendingMessage,
                onStartReply = mainVm::startReplyToMessage,
                onCancelReply = mainVm::cancelReplyToMessage,
                onStartEdit = mainVm::startEditMessage,
                onCancelEdit = mainVm::cancelEditMessage,
                onDeleteMessage = { messageId -> mainVm.deleteChatMessage(messageId) },
                onClearChat = mainVm::clearCurrentChatHistory,
                onArchiveChat = mainVm::archiveCurrentChat,
                onDeleteChat = mainVm::deleteCurrentChat,
                onOpenAttachment = mainVm::openAttachment,
                onDownloadAttachment = mainVm::downloadAttachmentToDevice,
                onLoadAttachmentPreview = mainVm::loadAttachmentPreview,
                onScheduleImagePreviewPreloads = mainVm::scheduleChatImagePreviewPreloads,
                onStartVideoCall = mainVm::startGafVideoCallFromChat,
                onStartGroupVideoCall = mainVm::openGafGroupVideoCallPicker,
                onProposeChatE2ee = mainVm::proposeChatE2ee,
                onAcceptChatE2ee = mainVm::acceptChatE2ee,
                onDeclineChatE2ee = mainVm::declineChatE2ee,
                onDisableChatE2ee = mainVm::disableChatE2ee,
                meDisplayName =
                    profileState.profile?.fullName
                        ?: profileState.profile?.username,
                meAvatarUrl = profileState.profile?.avatarUrl,
            )
        }
    }
}
