/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tab-host chrome state and UI: EW hub openers, bottom/rail navigation, media dock,
 * and EW hub / expanded player overlays. Extracted from TabHostCoordinator (W1 slice #4).
 *
 * Invariants:
 * - Deeplink / route contracts unchanged (MobileDeepLinks + MobileBackStackPolicy).
 * - Chrome does not own NavHost route graph (see TabHostNavGraph / TabHostAuthenticatedNav).
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostCoordinator.kt, TabHostNavGraph.kt, MobileShellNavigation.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.content.Context
import android.view.View
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import feature.desktop.AppStoreLaunch
import feature.desktop.ContentManagerLaunch
import feature.desktop.DesktopSettingsLaunch
import feature.desktop.EwaCompanionLaunch
import feature.desktop.EwaCompanionWebViewLauncher
import feature.desktop.EwDeskLaunch
import feature.desktop.FeedbackHubLaunch
import feature.desktop.HandbookLaunch
import feature.desktop.NotificationsLaunch
import feature.desktop.ProfessionalWorldsLaunch
import feature.desktop.SocialHubLaunch
import feature.profile.MobileUiStylePreferences
import kotlinx.coroutines.launch
import world.empery.mobile.core.media.EmperyExpandedPlayerSheet
import world.empery.mobile.core.media.EmperyMediaPlaybackState
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaTrack
import world.empery.mobile.core.media.EmperyNowPlayingDock
import world.empery.mobile.core.media.MusicPlayerFavoritesHolder
import world.empery.mobile.core.network.MobileWebOrigin
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.education.MobileEducationCard
import world.empery.mobile.education.MobileEducationCardId
import world.empery.mobile.education.MobileEducationCards
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.MobileFeatureShellPreferences
import world.empery.mobile.shell.MobileShellBottomNavigation
import world.empery.mobile.shell.MobileShellEwHubMenuSheet
import world.empery.mobile.shell.MobileShellSideNavigationRail


private fun readDismissedEducationCardIds(context: Context): Set<MobileEducationCardId> =
    MobileFeatureShellPreferences.getDismissedEducationCardIds(context).mapNotNull { raw ->
        runCatching { MobileEducationCardId.valueOf(raw) }.getOrNull()
    }.toSet()

data class TabHostChromeState(
    val totalUnreadChats: Int,
    val friendsAttentionCount: Int,
    val notificationsUnreadCount: Int,
    val mediaPlayerExpanded: Boolean,
    val setMediaPlayerExpanded: (Boolean) -> Unit,
    val ewHubMenuOpen: Boolean,
    val openEwHubMenu: () -> Unit,
    val dismissEwHubMenu: () -> Unit,
    val openEwHubAi: () -> Unit,
    val openEwHubMusic: () -> Unit,
    val openEwHubFiles: () -> Unit,
    val openEwHubEwaCompanion: () -> Unit,
    val openEwHubHandbook: () -> Unit,
    val openEwHubSocialHub: () -> Unit,
    val openEwHubFeedbackHub: () -> Unit,
    val openEwHubNotifications: () -> Unit,
    val openEwHubProfessionalWorlds: () -> Unit,
    val openEwHubAppStore: () -> Unit,
    val openEwHubDesktopSettings: () -> Unit,
    val openEwHubEwDesk: () -> Unit,
    val openFullEwDesk: () -> Unit,
    val openFullSocialHub: () -> Unit,
    val educationCards: List<MobileEducationCard>,
    val dismissedEducationCardIds: Set<MobileEducationCardId>,
    val setDismissedEducationCardIds: (Set<MobileEducationCardId>) -> Unit,
    val notificationsEnabled: Boolean,
    val setNotificationsEnabled: (Boolean) -> Unit,
    val wallpaperRevision: Int,
    val bumpWallpaperRevision: () -> Unit,
    val profilePrefsRevision: Int,
    val bumpProfilePrefsRevision: () -> Unit,
    val fontStressEnabled: Boolean,
    val setFontStressEnabled: (Boolean) -> Unit,
    val runtimeDiagExpanded: Boolean,
    val setRuntimeDiagExpanded: (Boolean) -> Unit,
    val analyticsEnabledPref: Boolean,
    val setAnalyticsEnabledPref: (Boolean) -> Unit,
    val shellStartDestination: String,
)

@Composable
fun rememberTabHostChromeState(
    navController: NavHostController,
    shell: MobileShellUiState,
    chatState: feature.chat.ChatUiState,
    friendsState: feature.friends.FriendsUiState,
    notificationsState: feature.notifications.NotificationCenterUiState,
    profileState: feature.profile.ProfileUiState,
    ugsState: feature.ugs.UgsHubUiState,
    privateTunnelBootstrapBlocked: Boolean,
    apiRootUrl: String,
    mainVm: MainViewModel,
): TabHostChromeState {
    val context = LocalContext.current
    val mobileApp = context.applicationContext as MobileApp
    val companionLaunchScope = rememberCoroutineScope()
    var mediaPlayerExpanded by remember { mutableStateOf(false) }
    var ewHubMenuOpen by remember { mutableStateOf(false) }
    var wallpaperRevision by remember { mutableIntStateOf(0) }
    var profilePrefsRevision by remember { mutableIntStateOf(0) }
    var dismissedEducationCardIds by remember(context.applicationContext) {
        mutableStateOf(readDismissedEducationCardIds(context.applicationContext))
    }
    var fontStressEnabled by remember(context.applicationContext) {
        mutableStateOf(MobileFeatureShellPreferences.isA11yFontStressEnabled(context.applicationContext))
    }
    var runtimeDiagExpanded by remember(context.applicationContext) {
        mutableStateOf(MobileFeatureShellPreferences.isRuntimeDiagnosticsExpanded(context.applicationContext))
    }
    var analyticsEnabledPref by remember(context.applicationContext) {
        mutableStateOf(MobileFeatureShellPreferences.isAnalyticsEnabled(context.applicationContext))
    }
    val shellStartDestination = remember(context) {
        world.empery.mobile.shell.MobileShellPreferences.resolveStartDestination(context)
    }
    var notificationsEnabled by remember(context.applicationContext) {
        mutableStateOf(MobileUiStylePreferences.getNotificationsEnabled(context))
    }
    val totalUnreadChats =
        remember(chatState.chats) {
            feature.chat.totalChatUnreadCount(chatState.chats)
        }
    val friendsAttentionCount =
        remember(friendsState.incomingRequests, friendsState.socialHubInbox) {
            friendsState.incomingRequests.size + friendsState.socialHubInbox.size
        }
    val notificationsUnreadCount =
        remember(notificationsState.items) {
            notificationsState.items.count { it.readAt.isNullOrBlank() }
        }
    val completedEducationCardIds =
        remember(
            profileState.profile?.fullName,
            profileState.profile?.avatarUrl,
            notificationsEnabled,
            friendsState.friends,
            chatState.chats,
            ugsState.stats?.total_generations,
        ) {
            buildSet {
                val profile = profileState.profile
                if (!profile?.fullName.isNullOrBlank() || !profile?.avatarUrl.isNullOrBlank()) {
                    add(MobileEducationCardId.PROFILE_COMPLETE)
                }
                if (notificationsEnabled) {
                    add(MobileEducationCardId.NOTIFICATIONS_ENABLE)
                }
                if (friendsState.friends.isNotEmpty()) {
                    add(MobileEducationCardId.FIRST_FRIEND)
                }
                if (chatState.chats.isNotEmpty()) {
                    add(MobileEducationCardId.FIRST_CHAT)
                }
                if ((ugsState.stats?.total_generations ?: 0) > 0) {
                    add(MobileEducationCardId.FIRST_UGS_GENERATION)
                }
            }
        }
    val educationCards =
        remember(dismissedEducationCardIds, completedEducationCardIds) {
            MobileEducationCards.visibleCards(dismissedEducationCardIds, completedEducationCardIds).take(3)
        }

    val openEwHubAi: () -> Unit = {
        MobileBackStackPolicy.navigateEwHubAi(navController)
    }
    val openEwHubMusic: () -> Unit = {
        mediaPlayerExpanded = true
    }
    val openEwHubFiles: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            ContentManagerLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubEwaCompanion: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            EwaCompanionLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val pendingEmbeddedSpa by mainVm.pendingEmbeddedSpaDeepLink.collectAsStateWithLifecycle()
    LaunchedEffect(pendingEmbeddedSpa, shell.isAuthenticated, privateTunnelBootstrapBlocked, apiRootUrl) {
        val link = pendingEmbeddedSpa ?: return@LaunchedEffect
        if (!shell.isAuthenticated || privateTunnelBootstrapBlocked) return@LaunchedEffect
        mainVm.consumePendingEmbeddedSpaDeepLink()
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            when (link.spaHash) {
                EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH ->
                    EwaCompanionLaunch.tryLaunch(
                        activity = activity,
                        webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                        accessToken = tokens?.accessToken,
                        refreshToken = tokens?.refreshToken,
                        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                        hashQuery = link.hashQuery,
                    )
            }
        }
    }
    val openEwHubHandbook: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            HandbookLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubSocialHub: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            SocialHubLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubFeedbackHub: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            FeedbackHubLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubNotifications: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            NotificationsLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubProfessionalWorlds: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            ProfessionalWorldsLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubAppStore: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            AppStoreLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubDesktopSettings: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            DesktopSettingsLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openFullEwDesk: () -> Unit = {
        val activity = context as ComponentActivity
        companionLaunchScope.launch {
            runCatching { mobileApp.container.authRepository.ensureFreshAccessToken() }
            val tokens = mobileApp.container.authRepository.readSpaOidcBootstrapTokens()
            EwDeskLaunch.tryLaunch(
                activity = activity,
                webOrigin = MobileWebOrigin.fromApiBase(apiRootUrl),
                accessToken = tokens?.accessToken,
                refreshToken = tokens?.refreshToken,
                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            )
        }
    }
    val openEwHubEwDesk: () -> Unit = openFullEwDesk
    val openFullSocialHub: () -> Unit = openEwHubSocialHub
    val openEwHubMenu: () -> Unit = {
        ewHubMenuOpen = true
    }

    // currentRoute close menu — caller also tracks route; close on any nav via effect param
    // Caller should pass currentRoute into TabHostCloseEwHubOnRouteChange

    return TabHostChromeState(
        totalUnreadChats = totalUnreadChats,
        friendsAttentionCount = friendsAttentionCount,
        notificationsUnreadCount = notificationsUnreadCount,
        mediaPlayerExpanded = mediaPlayerExpanded,
        setMediaPlayerExpanded = { mediaPlayerExpanded = it },
        ewHubMenuOpen = ewHubMenuOpen,
        openEwHubMenu = openEwHubMenu,
        dismissEwHubMenu = { ewHubMenuOpen = false },
        openEwHubAi = openEwHubAi,
        openEwHubMusic = openEwHubMusic,
        openEwHubFiles = openEwHubFiles,
        openEwHubEwaCompanion = openEwHubEwaCompanion,
        openEwHubHandbook = openEwHubHandbook,
        openEwHubSocialHub = openEwHubSocialHub,
        openEwHubFeedbackHub = openEwHubFeedbackHub,
        openEwHubNotifications = openEwHubNotifications,
        openEwHubProfessionalWorlds = openEwHubProfessionalWorlds,
        openEwHubAppStore = openEwHubAppStore,
        openEwHubDesktopSettings = openEwHubDesktopSettings,
        openEwHubEwDesk = openEwHubEwDesk,
        openFullEwDesk = openFullEwDesk,
        openFullSocialHub = openFullSocialHub,
        educationCards = educationCards,
        dismissedEducationCardIds = dismissedEducationCardIds,
        setDismissedEducationCardIds = { dismissedEducationCardIds = it },
        notificationsEnabled = notificationsEnabled,
        setNotificationsEnabled = { notificationsEnabled = it },
        wallpaperRevision = wallpaperRevision,
        bumpWallpaperRevision = { wallpaperRevision++ },
        profilePrefsRevision = profilePrefsRevision,
        bumpProfilePrefsRevision = { profilePrefsRevision++ },
        fontStressEnabled = fontStressEnabled,
        setFontStressEnabled = { fontStressEnabled = it },
        runtimeDiagExpanded = runtimeDiagExpanded,
        setRuntimeDiagExpanded = { runtimeDiagExpanded = it },
        analyticsEnabledPref = analyticsEnabledPref,
        setAnalyticsEnabledPref = { analyticsEnabledPref = it },
        shellStartDestination = shellStartDestination,
    )
}

@Composable
fun TabHostCloseEwHubOnRouteChange(
    currentRoute: String?,
    chrome: TabHostChromeState,
) {
    LaunchedEffect(currentRoute) {
        chrome.dismissEwHubMenu()
    }
}

@Composable
fun TabHostSideRail(
    isAuthenticated: Boolean,
    useNavigationRail: Boolean,
    currentRoute: String?,
    profileUpdateAvailable: Boolean,
    chrome: TabHostChromeState,
    navBarContainerColor: Color,
    navBarBorderColor: Color,
    surfaceStyle: MobileSurfaceStyle,
    navController: NavHostController,
    hapticView: View?,
    reduceMotion: Boolean,
) {
    if (isAuthenticated && useNavigationRail) {
        MobileShellSideNavigationRail(
            currentRoute = currentRoute,
            profileUpdateAvailable = profileUpdateAvailable,
            totalUnreadChats = chrome.totalUnreadChats,
            friendsAttentionCount = chrome.friendsAttentionCount,
            notificationsUnreadCount = chrome.notificationsUnreadCount,
            navBarContainerColor = navBarContainerColor,
            navBarBorderColor = navBarBorderColor,
            surfaceStyle = surfaceStyle,
            navController = navController,
            hapticView = hapticView,
            reduceMotion = reduceMotion,
            onOpenEwHubMenu = chrome.openEwHubMenu,
        )
    }
}

@Composable
fun TabHostBottomBar(
    isAuthenticated: Boolean,
    hideBottomBarForKeyboard: Boolean,
    useBottomNavigation: Boolean,
    currentRoute: String?,
    profileUpdateAvailable: Boolean,
    chrome: TabHostChromeState,
    mediaPlaybackState: EmperyMediaPlaybackState,
    navBarContainerColor: Color,
    navBarBorderColor: Color,
    surfaceStyle: MobileSurfaceStyle,
    navController: NavHostController,
    hapticView: View?,
    reduceMotion: Boolean,
) {
    if (isAuthenticated && !hideBottomBarForKeyboard) {
        val showMediaDock =
            mediaPlaybackState.hasActiveTrack && !chrome.mediaPlayerExpanded
        Column {
            if (showMediaDock) {
                EmperyNowPlayingDock(
                    state = mediaPlaybackState,
                    onTogglePlayPause = { EmperyMediaPlayerHolder.controller.togglePlayPause() },
                    onSeek = { EmperyMediaPlayerHolder.controller.seekTo(it) },
                    onStop = {
                        chrome.setMediaPlayerExpanded(false)
                        EmperyMediaPlayerHolder.controller.stop()
                    },
                    onExpand = { chrome.setMediaPlayerExpanded(true) },
                    onSkipPrevious = { EmperyMediaPlayerHolder.controller.skipToPrevious() },
                    onSkipNext = { EmperyMediaPlayerHolder.controller.skipToNext() },
                    onRetry = { EmperyMediaPlayerHolder.controller.retryCurrentTrack() },
                    surfaceStyle = surfaceStyle,
                    containerColor = navBarContainerColor,
                    borderColor = navBarBorderColor,
                )
            }
            if (useBottomNavigation) {
                MobileShellBottomNavigation(
                    currentRoute = currentRoute,
                    profileUpdateAvailable = profileUpdateAvailable,
                    totalUnreadChats = chrome.totalUnreadChats,
                    friendsAttentionCount = chrome.friendsAttentionCount,
                    notificationsUnreadCount = chrome.notificationsUnreadCount,
                    navBarContainerColor = navBarContainerColor,
                    navBarBorderColor = navBarBorderColor,
                    surfaceStyle = surfaceStyle,
                    stackedBelowDock = showMediaDock,
                    navController = navController,
                    hapticView = hapticView,
                    reduceMotion = reduceMotion,
                    onOpenEwHubMenu = chrome.openEwHubMenu,
                )
            }
        }
    }
}

@Composable
fun TabHostEwHubAndMediaOverlays(
    isAuthenticated: Boolean,
    chrome: TabHostChromeState,
    mediaPlaybackState: EmperyMediaPlaybackState,
    favoriteTrackIds: Set<String>,
    favoriteTracks: List<EmperyMediaTrack>,
    favoritesLoading: Boolean,
) {
    if (!isAuthenticated) return
    MobileShellEwHubMenuSheet(
        visible = chrome.ewHubMenuOpen,
        onDismiss = chrome.dismissEwHubMenu,
        onOpenEwaCompanion = chrome.openEwHubEwaCompanion,
        onOpenHandbook = chrome.openEwHubHandbook,
        onOpenSocialHub = chrome.openEwHubSocialHub,
        onOpenFeedbackHub = chrome.openEwHubFeedbackHub,
        onOpenNotifications = chrome.openEwHubNotifications,
        onOpenAi = chrome.openEwHubAi,
        onOpenMusic = chrome.openEwHubMusic,
        onOpenFiles = chrome.openEwHubFiles,
        onOpenProfessionalWorlds = chrome.openEwHubProfessionalWorlds,
        onOpenAppStore = chrome.openEwHubAppStore,
        onOpenDesktopSettings = chrome.openEwHubDesktopSettings,
        onOpenEwDesk = chrome.openEwHubEwDesk,
    )
    if (chrome.mediaPlayerExpanded) {
        EmperyExpandedPlayerSheet(
            state = mediaPlaybackState,
            favoriteIds = favoriteTrackIds,
            favoriteTracks = favoriteTracks,
            favoritesLoading = favoritesLoading,
            onDismiss = { chrome.setMediaPlayerExpanded(false) },
            onTogglePlayPause = { EmperyMediaPlayerHolder.controller.togglePlayPause() },
            onSeek = { EmperyMediaPlayerHolder.controller.seekTo(it) },
            onStop = {
                chrome.setMediaPlayerExpanded(false)
                EmperyMediaPlayerHolder.controller.stop()
            },
            onSkipPrevious = { EmperyMediaPlayerHolder.controller.skipToPrevious() },
            onSkipNext = { EmperyMediaPlayerHolder.controller.skipToNext() },
            onSkipBack = { EmperyMediaPlayerHolder.controller.skipBack() },
            onSkipForward = { EmperyMediaPlayerHolder.controller.skipForward() },
            onRetry = { EmperyMediaPlayerHolder.controller.retryCurrentTrack() },
            onToggleShuffle = { EmperyMediaPlayerHolder.controller.toggleShuffle() },
            onToggleRepeat = { EmperyMediaPlayerHolder.controller.toggleRepeat() },
            onCyclePlaybackSpeed = { EmperyMediaPlayerHolder.controller.cyclePlaybackSpeed() },
            onCycleSleepTimer = { EmperyMediaPlayerHolder.controller.cycleSleepTimer() },
            onJumpToQueueIndex = { EmperyMediaPlayerHolder.controller.jumpToQueueIndex(it) },
            onToggleFavorite = { MusicPlayerFavoritesHolder.toggleFavorite(it) },
            onPlayFavoriteTrack = { selected ->
                val tracks = favoriteTracks
                if (tracks.isNotEmpty()) {
                    val startIndex = tracks.indexOfFirst { it.id == selected.id }.coerceAtLeast(0)
                    EmperyMediaPlayerHolder.controller.playQueue(tracks, startIndex)
                } else {
                    EmperyMediaPlayerHolder.controller.play(selected)
                }
            },
        )
    }
}
