/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS tab + nested NavHost destinations (chat/images/songs/content/presentations/desktop)
 * for TabHostAuthenticatedNav. Extracted from TabHostNavGraph (Hardened residual).
 *
 * Invariants:
 * - Route strings and nested UGS deeplink paths stay identical to pre-split TabHostNavGraph.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostNavGraph.kt, MobileBackStackPolicy.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0 Hardened residual
 */
package world.empery.mobile

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import feature.desktop.AppStoreLaunch
import feature.desktop.ContentManagerLaunch
import feature.desktop.DesktopSettingsLaunch
import feature.desktop.EwaCompanionLaunch
import feature.desktop.EwDeskLaunch
import feature.desktop.FeedbackHubLaunch
import feature.desktop.HandbookLaunch
import feature.desktop.NotificationsLaunch
import feature.desktop.ProfessionalWorldsLaunch
import feature.desktop.SocialHubLaunch
import world.empery.mobile.core.network.MobileWebOrigin
import world.empery.mobile.core.ui.MobileInstalledAppRoutes
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.MobileShellNestedContextScaffold
import world.empery.mobile.shell.RootTab
import world.empery.mobile.tabs.DesktopHubTabViewModel
import world.empery.mobile.tabs.UgsHubTabViewModel

internal fun NavGraphBuilder.tabHostUgsRoutes(
    navController: NavHostController,
    context: Context,
    mobileApp: MobileApp,
    ugsVm: UgsHubTabViewModel,
    desktopHubVm: DesktopHubTabViewModel,
    ugsState: feature.ugs.UgsHubUiState,
    desktopHubState: feature.desktop.DesktopHubUiState,
    apiRootUrl: String,
    privateTunnelBootstrapBlocked: Boolean,
    onOpenUrl: (String) -> Unit,
) {
    composable(RootTab.Ugs.route) {
        RefreshableRoute(
            isRefreshing = ugsState.isLoading,
            onRefresh = ugsVm::refresh,
        ) {
            feature.ugs.UgsHubScreen(
                state = ugsState,
                onRefresh = ugsVm::refresh,
                onOpenAiChat = { MobileBackStackPolicy.navigateNested(navController, "ugs/chat") },
                onOpenImages = { MobileBackStackPolicy.navigateNested(navController, "ugs/images") },
                onOpenSongs = { MobileBackStackPolicy.navigateNested(navController, "ugs/songs") },
                onOpenPresentations = { MobileBackStackPolicy.navigateNested(navController, "ugs/presentations") },
                onOpenDesktop = { MobileBackStackPolicy.navigateNested(navController, "ugs/desktop") },
                onOpenContentLibrary = { MobileBackStackPolicy.navigateNested(navController, "ugs/content") },
            )
        }
    }
    composable("ugs/chat") {
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_ai_chats_label),
            detail = stringResource(R.string.mobile_context_ugs_ai_chats_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.UgsAiChatListScreen(
                repository = mobileApp.container.ugsHubRepository,
                onBack = { navController.popBackStack() },
                onOpenChat = { id: String, name: String ->
                    navController.navigate("ugs/chat/$id?name=${android.net.Uri.encode(name)}")
                },
            )
        }
    }
    composable(
        "ugs/chat/{chatId}?name={name}",
        arguments = listOf(
            androidx.navigation.navArgument("chatId") { type = androidx.navigation.NavType.StringType },
            androidx.navigation.navArgument("name") {
                type = androidx.navigation.NavType.StringType
                defaultValue = context.getString(R.string.app_nav_ai_chat_default)
            },
        ),
    ) { backStackEntry ->
        val chatId = backStackEntry.arguments?.getString("chatId") ?: return@composable
        val heroName = backStackEntry.arguments?.getString("name")
            ?: context.getString(R.string.app_nav_ai_chat_default)
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_ai_chats_label),
            detail = heroName,
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.UgsAiChatDetailScreen(
                repository = mobileApp.container.ugsHubRepository,
                chatId = chatId,
                heroName = heroName,
                onBack = { navController.popBackStack() },
            )
        }
    }
    composable("ugs/images") {
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_images_label),
            detail = stringResource(R.string.mobile_context_ugs_images_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.UgsImagesScreen(
                repository = mobileApp.container.ugsHubRepository,
                onBack = { navController.popBackStack() },
            )
        }
    }
    composable("ugs/songs") {
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_songs_label),
            detail = stringResource(R.string.mobile_context_ugs_songs_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.UgsSongsScreen(
                repository = mobileApp.container.ugsHubRepository,
                onBack = { navController.popBackStack() },
                onOpenContentLibrary = {
                    MobileBackStackPolicy.navigateNested(navController, "ugs/content")
                },
            )
        }
    }
    composable("ugs/content") {
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_content_label),
            detail = stringResource(R.string.mobile_context_ugs_content_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.MobileContentLibraryScreen(
                repository = mobileApp.container.ugsHubRepository,
                onBack = { navController.popBackStack() },
            )
        }
    }
    composable("ugs/presentations") {
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_presentations_label),
            detail = stringResource(R.string.mobile_context_ugs_presentations_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.ugs.UgsPresentationsScreen(
                repository = mobileApp.container.ugsHubRepository,
                onBack = { navController.popBackStack() },
            )
        }
    }
    composable("ugs/desktop") {
        LaunchedEffect(Unit) { desktopHubVm.refresh() }
        MobileShellNestedContextScaffold(
            label = stringResource(R.string.mobile_context_ugs_desktop_label),
            detail = stringResource(R.string.mobile_context_ugs_desktop_detail),
            icon = Icons.Outlined.AutoAwesome,
        ) {
            feature.desktop.DesktopHubScreen(
                state = desktopHubState,
                apiRootUrl = apiRootUrl,
                onBack = { navController.popBackStack() },
                onRefresh = desktopHubVm::refresh,
                onInstallApp = desktopHubVm::installApp,
                onUninstallApp = desktopHubVm::uninstallApp,
                onCreateNote = desktopHubVm::createNote,
                onDeleteNote = desktopHubVm::deleteNote,
                onCreateTodo = desktopHubVm::createTodo,
                onToggleTodo = desktopHubVm::toggleTodo,
                onDeleteTodo = desktopHubVm::deleteTodo,
                onCreateFavorite = desktopHubVm::createFavorite,
                onDeleteFavorite = desktopHubVm::deleteFavorite,
                onCycleTheme = desktopHubVm::cycleTheme,
                onToggleQuietMode = desktopHubVm::toggleQuietMode,
                handoffDraftText = desktopHubVm.handoffDraftText,
                onHandoffDraftChange = desktopHubVm::updateHandoffDraft,
                onSaveHandoffDraft = desktopHubVm::saveHandoffDraft,
                focusSectionId = desktopHubState.focusSectionId,
                onFocusSectionConsumed = desktopHubVm::consumeFocusSection,
                onOpenEwaCompanion = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    EwaCompanionLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenHandbook = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    HandbookLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenSocialHub = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    SocialHubLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenFeedbackHub = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    FeedbackHubLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenNotifications = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    NotificationsLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenContentManager = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    ContentManagerLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenEwDesk = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    EwDeskLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenProfessionalWorlds = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    ProfessionalWorldsLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenAppStore = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    AppStoreLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenDesktopSettings = {
                    val tokens =
                        mobileApp.container.authRepository
                            .readSpaOidcBootstrapTokens()
                    DesktopSettingsLaunch.tryLaunch(
                        activity = context as ComponentActivity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                    )
                },
                onOpenStoreApp = { appId ->
                    navController.popBackStack()
                    MobileBackStackPolicy.navigateBottomTab(
                        navController,
                        MobileInstalledAppRoutes.bottomTabRouteForStoreAppId(appId),
                    )
                },
                onOpenFavoriteUrl = onOpenUrl,
            )
        }
    }
}
