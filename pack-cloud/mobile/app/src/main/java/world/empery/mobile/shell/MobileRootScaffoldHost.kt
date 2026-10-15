/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MobileRoot Compose shell host extracted from MainActivity: SSO/tunnel wiring, scaffold
 * chrome, tab host, auth gate, and MobilePermissionShell integration.
 *
 * Invariants:
 * - Deeplink apply stays TabHostShellNavigationEffect; OAuth callback stays in MainActivity.
 * - VPN / SSO ActivityResultLaunchers remain registered in this composition.
 * - Permission rationale/banners live in MobilePermissionShell.
 * - Package remains [world.empery.mobile] for a thin public shell API from MainActivity.
 *
 * Related:
 * - MainActivity, MobilePermissionShell.kt, TabHostCoordinator, TunnelShellBridge,
 *   AuthSessionGate, GafVideoCallOverlayHost, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import feature.profile.MobileColorMode
import feature.profile.MobileUiStyle
import feature.profile.MobileUiStylePreferences
import feature.profile.PerimeterAccessStatus
import feature.profile.PerimeterAccessUiState
import feature.profile.PerimeterManualAuthBanner
import feature.profile.requiresManualYandexAuth
import kotlinx.coroutines.flow.collectLatest
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceHost
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceRequest
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceResult
import world.empery.mobile.core.auth.MobileSsoLaunchPlan
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.MusicPlayerFavoritesHolder
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.core.ui.LocalMobileApiBaseUrl
import world.empery.mobile.core.ui.LocalMobilePermissionRequester
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.rememberHapticView
import world.empery.mobile.core.ui.rememberReduceMotionEnabled
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileRouteRegistry
import world.empery.mobile.shell.MobileShellPreferences
import world.empery.mobile.shell.MobileShellTabErrorSnackbarEffect
import world.empery.mobile.shell.RootTab
import world.empery.mobile.shell.resolveFirstShellTabError
import world.empery.mobile.sync.MobileOfflineCacheSupport
import world.empery.mobile.tabs.DesktopHubTabViewModel
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel
import world.empery.mobile.tabs.UgsHubTabViewModel
import world.empery.mobile.theme.MobileThemeGradientLayer

private const val MAIN_ACTIVITY_TAG = "MobileRoot"

@Composable
fun LogoutConfirmDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(feature.profile.R.string.profile_logout_confirm_title)) },
        text = { Text(stringResource(R.string.logout_confirm_body_local_data)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(feature.profile.R.string.profile_logout_confirm_yes))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(feature.profile.R.string.profile_logout_confirm_no))
            }
        },
    )
}

@Composable
fun MobileRoot(
    vm: MainViewModel,
    feedVm: FeedTabViewModel,
    notificationsVm: NotificationsTabViewModel,
    profileVm: ProfileTabViewModel,
    friendsVm: FriendsTabViewModel,
    desktopHubVm: DesktopHubTabViewModel,
    ugsVm: UgsHubTabViewModel,
    onOpenUrl: (String) -> Unit,
    mobileUiStyle: MobileUiStyle,
    displayMobileUiStyle: MobileUiStyle = mobileUiStyle,
    mobileColorMode: MobileColorMode,
    mobileUiScale: MobileUiScale,
    chatVisualStyle: ChatVisualStyle,
    chatTypography: ChatTypographySettings,
    darkTheme: Boolean,
    onMobileUiStyleChange: (MobileUiStyle) -> Unit,
    onMobileColorModeChange: (MobileColorMode) -> Unit,
    onMobileUiScaleChange: (MobileUiScale) -> Unit,
    onChatVisualStyleChange: (ChatVisualStyle) -> Unit,
    onChatTypographyChange: (ChatTypographySettings) -> Unit,
    biometricPromptInFlight: Boolean,
    onBiometricUnlockRequest: () -> Unit,
    onLogoutRequest: () -> Unit,
) {
    val windowLayout = LocalMobileWindowLayout.current
    val navController = rememberNavController()
    val hapticView = rememberHapticView()
    val reduceMotion = rememberReduceMotionEnabled()
    val ssoLoginLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                vm.handleAppAuthCallbackResult(result.data)
            } else if (!vm.shellUiState.value.isAuthenticated) {
                // Canceled/finished without redirect. Clear in-progress; keep authError only if
                // exchange already set one (do not invent a failure for explicit user cancel).
                vm.onSsoLoginCanceled()
            }
        }
    val onPrivateTunnelNetworkCutover: () -> Unit = {
        profileVm.onAuthenticatedNetworkReady()
        vm.resumeRealtimeAfterPrivateTunnelNetworkCutover()
    }
    val privateTunnelPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                profileVm.startPrivateTunnel(onCompleted = onPrivateTunnelNetworkCutover)
            } else {
                profileVm.onPrivateTunnelPermissionRejected()
                onPrivateTunnelNetworkCutover()
            }
        }
    val context = LocalContext.current
    var ssoBrowserChoiceRequest by remember { mutableStateOf<MobileSsoBrowserChoiceRequest?>(null) }
    var ssoBrowserChoiceOnResult by remember {
        mutableStateOf<((MobileSsoBrowserChoiceResult) -> Unit)?>(null)
    }
    val ssoBrowserChoiceHost =
        remember {
            MobileSsoBrowserChoiceHost { request, onResult ->
                ssoBrowserChoiceRequest = request
                ssoBrowserChoiceOnResult = onResult
            }
        }
    val launchSsoLoginPlan: (MobileSsoLaunchPlan) -> Unit = { plan ->
        when (val step = ssoLoginShellStepForPlan(plan)) {
            is SsoLoginShellStep.LaunchIntent -> {
                // Strip task flags that may be re-applied by OEMs; keep same-task for result.
                step.intent.flags = step.intent.flags and
                    (
                        Intent.FLAG_ACTIVITY_NEW_TASK.inv() and
                            Intent.FLAG_ACTIVITY_CLEAR_TOP.inv() and
                            Intent.FLAG_ACTIVITY_NEW_DOCUMENT.inv()
                        )
                ssoLoginLauncher.launch(step.intent)
            }
            is SsoLoginShellStep.ShowBrowserPicker ->
                ssoBrowserChoiceHost.showBrowserChoice(step.request) { result ->
                    runCatching {
                        vm.resolveSsoLoginAfterBrowserChoice(step.request, result)
                    }.onSuccess { intent ->
                        if (intent != null) {
                            intent.flags = intent.flags and
                                (
                                    Intent.FLAG_ACTIVITY_NEW_TASK.inv() and
                                        Intent.FLAG_ACTIVITY_CLEAR_TOP.inv() and
                                        Intent.FLAG_ACTIVITY_NEW_DOCUMENT.inv()
                                    )
                            ssoLoginLauncher.launch(intent)
                        } else {
                            vm.onSsoLoginCanceled()
                        }
                    }.onFailure { err ->
                        MobileTelemetry.reportError(err, "resolveSsoLoginAfterBrowserChoice failed")
                        vm.onSsoLoginCanceled()
                        vm.setAuthError(
                            err.message
                                ?: context.getString(
                                    world.empery.mobile.core.auth.R.string.auth_sso_browser_pick_failed,
                                ),
                        )
                    }
                    ssoBrowserChoiceRequest = null
                    ssoBrowserChoiceOnResult = null
                }
        }
    }
    val mobileApp = context.applicationContext as MobileApp
    val shell by vm.shellUiState.collectAsStateWithLifecycle()
    val gafVideoCall by vm.gafVideoCallOverlay.collectAsStateWithLifecycle()
    val gafGroupCallPicker by vm.gafGroupCallPicker.collectAsStateWithLifecycle()
    val incomingGafVideoCall by vm.incomingGafVideoCall.collectAsStateWithLifecycle()
    val outgoingGafVideoCall by vm.outgoingGafVideoCall.collectAsStateWithLifecycle()
    val feedState by feedVm.uiState.collectAsStateWithLifecycle()
    val notificationsState by notificationsVm.uiState.collectAsStateWithLifecycle()
    val profileState by profileVm.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(profileVm) {
        profileVm.restartAppEvents.collect {
            MobileAppRestart.restart(context)
        }
    }
    val friendsState by friendsVm.uiState.collectAsStateWithLifecycle()
    val desktopHubState by desktopHubVm.uiState.collectAsStateWithLifecycle()
    val ugsState by ugsVm.uiState.collectAsStateWithLifecycle()
    val chatState by vm.chatUiState.collectAsStateWithLifecycle()
    val socketLifecycle by vm.socketLifecycleState.collectAsStateWithLifecycle()
    val mediaPlaybackState by EmperyMediaPlayerHolder.controller.state.collectAsStateWithLifecycle()
    val transientAuthNetworkDeferral by vm.transientAuthNetworkDeferral.collectAsStateWithLifecycle()
    val tunnel =
        rememberTunnelShellBridge(
            navController = navController,
            transientAuthNetworkDeferral = transientAuthNetworkDeferral,
            mainVm = vm,
            feedVm = feedVm,
            notificationsVm = notificationsVm,
            profileVm = profileVm,
            friendsVm = friendsVm,
            ugsVm = ugsVm,
            onNetworkRestored = vm::onNetworkRestored,
            onUnderlyingNetworkChanged = vm::onUnderlyingNetworkChanged,
            onPrepareForPrivateTunnelNetworkCutover = vm::prepareForPrivateTunnelNetworkCutover,
            onRequestPrivateTunnelStart = {
                val permissionIntent = profileVm.privateTunnelPermissionIntent()
                if (permissionIntent != null) {
                    privateTunnelPermissionLauncher.launch(permissionIntent)
                } else {
                    profileVm.startPrivateTunnel(onCompleted = onPrivateTunnelNetworkCutover)
                }
            },
            onProbePerimeterAccess = {
                mobileApp.perimeterAccessCoordinator.probeNow()
            },
        )
    val privateTunnelBootstrapBlocked = tunnel.privateTunnelBootstrapBlocked
    val eliteEwNetworkAvailable = tunnel.eliteEwNetworkAvailable
    val isOnline = tunnel.isOnline
    val favoriteTrackIds by MusicPlayerFavoritesHolder.favoriteIds.collectAsStateWithLifecycle()
    val favoriteTracks by MusicPlayerFavoritesHolder.favoriteTracks.collectAsStateWithLifecycle()
    val favoritesLoading by MusicPlayerFavoritesHolder.loading.collectAsStateWithLifecycle()
    LaunchedEffect(shell.isAuthenticated, privateTunnelBootstrapBlocked) {
        if (shell.isAuthenticated && !privateTunnelBootstrapBlocked) {
            MusicPlayerFavoritesHolder.refresh()
        }
    }
    val tabError =
        remember(
            feedState.error,
            notificationsState.error,
            profileState.error,
            friendsState.error,
            desktopHubState.error,
            ugsState.error,
            chatState.error,
        ) {
            resolveFirstShellTabError(
                feedState.error,
                notificationsState.error,
                profileState.error,
                friendsState.error,
                desktopHubState.error,
                ugsState.error,
                chatState.error,
            )
        }
    val mobileProfileSync = remember(mobileApp) { mobileApp.mobileProfileSync }

    val perimeterState by mobileApp.container.perimeterAccessRepository.state.collectAsStateWithLifecycle(
        initialValue = PerimeterAccessUiState(),
    )
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val snackbarHostState = remember { SnackbarHostState() }
    val lastSnackbarMessage = remember { mutableStateOf<String?>(null) }
    val apiRootUrl =
        remember(context.applicationContext) {
            AppRuntimeConfig.from(context.applicationContext).baseUrl
        }
    val feedAuthorizedHttpClient =
        remember(context.applicationContext) {
            (context.applicationContext as MobileApp).container.okHttpClient
        }

    val tabHostChrome =
        rememberTabHostChromeState(
            navController = navController,
            shell = shell,
            chatState = chatState,
            friendsState = friendsState,
            notificationsState = notificationsState,
            profileState = profileState,
            ugsState = ugsState,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            apiRootUrl = apiRootUrl,
            mainVm = vm,
        )
    TabHostCloseEwHubOnRouteChange(
        currentRoute = currentRoute,
        chrome = tabHostChrome,
    )
    LaunchedEffect(tabHostChrome.mediaPlayerExpanded, privateTunnelBootstrapBlocked) {
        if (tabHostChrome.mediaPlayerExpanded && !privateTunnelBootstrapBlocked) {
            MusicPlayerFavoritesHolder.refresh()
        }
    }
    LaunchedEffect(mobileProfileSync, onMobileUiStyleChange, onMobileColorModeChange, onMobileUiScaleChange, tabHostChrome) {
        mobileProfileSync.onApplied = { snapshot ->
            onMobileUiStyleChange(snapshot.uiStyle)
            onMobileColorModeChange(snapshot.colorMode)
            onMobileUiScaleChange(snapshot.uiScale)
            tabHostChrome.setNotificationsEnabled(snapshot.notificationsEnabled)
            tabHostChrome.bumpWallpaperRevision()
            tabHostChrome.bumpProfilePrefsRevision()
        }
    }

    MobileShellTabErrorSnackbarEffect(
        tabError = tabError,
        snackbarHostState = snackbarHostState,
        lastSnackbarMessage = lastSnackbarMessage,
    )

    LaunchedEffect(vm) {
        vm.userMessage.collectLatest { message ->
            if (message != lastSnackbarMessage.value) {
                lastSnackbarMessage.value = message
                snackbarHostState.showSnackbar(message)
            }
        }
    }

    TabHostShellNavigationEffect(
        navController = navController,
        mainVm = vm,
        feedVm = feedVm,
        friendsVm = friendsVm,
        notificationsVm = notificationsVm,
        profileVm = profileVm,
        desktopHubVm = desktopHubVm,
    )


    LaunchedEffect(socketLifecycle) {
        profileVm.refreshDeviceSession(socketLifecycle)
    }

    LaunchedEffect(currentRoute, shell.isAuthenticated, privateTunnelBootstrapBlocked) {
        if (!shell.isAuthenticated) return@LaunchedEffect
        if (MobileRouteRegistry.isBottomTabRoute(currentRoute)) {
            MobileShellPreferences.setLastBottomTabRoute(context, currentRoute!!)
        }
        if (privateTunnelBootstrapBlocked) return@LaunchedEffect
        if (currentRoute == RootTab.Chat.route) {
            vm.refreshChats()
        }
    }

    GafVideoCallMeetLaunchEffects(gafVideoCall = gafVideoCall)

    val permissions =
        rememberMobilePermissionShell(
            isAuthenticated = shell.isAuthenticated,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
        )

    LaunchedEffect(shell.isAuthenticated, privateTunnelBootstrapBlocked) {
        if (!shell.isAuthenticated) return@LaunchedEffect
        if (privateTunnelBootstrapBlocked) {
            logPermissionShellWarmupDeferred()
            return@LaunchedEffect
        }
        runCatching {
            profileVm.checkForUpdatesIfStale()
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                MobileOfflineCacheSupport.warmStartupCaches(mobileApp.container, context)
                mobileProfileSync.pullAndApply()
            }
        }.onFailure { err ->
            Log.w(MAIN_ACTIVITY_TAG, "Authenticated startup warmup skipped after network failure", err)
        }
    }
    val bgImageUri =
        remember(mobileUiStyle, tabHostChrome.wallpaperRevision) {
            MobileUiStylePreferences.getBackgroundImage(context)
        }

    val useSolidScaffoldForLists =
        currentRoute == RootTab.Chat.route || currentRoute == RootTab.Feed.route
    val density = LocalDensity.current
    val imeBottomPx = WindowInsets.ime.getBottom(density)
    val isUgsKeyboardInsetRoute =
        currentRoute?.startsWith("ugs/chat") == true ||
            currentRoute == "ugs/songs" ||
            currentRoute == "ugs/images" ||
            currentRoute == "ugs/presentations" ||
            currentRoute == "ugs/content"
    val isGafChatKeyboardInsetRoute =
        currentRoute == RootTab.Chat.route && chatState.selectedChatId != null
    val hideBottomBarForKeyboard = (isUgsKeyboardInsetRoute || isGafChatKeyboardInsetRoute) && imeBottomPx > 0
    val showAmbientGradient =
        displayMobileUiStyle.usesAmbientGradient() && bgImageUri.isNullOrBlank()
    val surfaceStyle = displayMobileUiStyle.toSurfaceStyle()

    val navBarContainerColor =
        when {
            surfaceStyle == MobileSurfaceStyle.SYSTEM && bgImageUri.isNullOrBlank() ->
                MaterialTheme.colorScheme.surface
            surfaceStyle == MobileSurfaceStyle.GLASS ->
                MaterialTheme.colorScheme.surface.copy(alpha = 0.62f)
            else ->
                MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.94f)
        }
    val navBarBorderColor =
        when (surfaceStyle) {
            MobileSurfaceStyle.GLASS -> Color.White.copy(alpha = 0.42f)
            MobileSurfaceStyle.PREMIUM -> MaterialTheme.colorScheme.primary.copy(alpha = 0.38f)
            MobileSurfaceStyle.SYSTEM -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.32f)
        }
    val scaffoldContainerColor =
        when {
            !bgImageUri.isNullOrBlank() -> Color.Transparent
            surfaceStyle == MobileSurfaceStyle.SYSTEM -> MaterialTheme.colorScheme.background
            surfaceStyle == MobileSurfaceStyle.GLASS ->
                MaterialTheme.colorScheme.background.copy(alpha = if (useSolidScaffoldForLists) 0.38f else 0.22f)
            else ->
                MaterialTheme.colorScheme.background.copy(alpha = if (useSolidScaffoldForLists) 0.76f else 0.48f)
        }
    Box(modifier = Modifier.fillMaxSize()) {
        if (showAmbientGradient) {
            MobileThemeGradientLayer(style = displayMobileUiStyle, darkTheme = darkTheme)
        }
        if (!bgImageUri.isNullOrBlank()) {
            androidx.compose.runtime.key(tabHostChrome.wallpaperRevision, bgImageUri) {
                // Atmosphere layer: soft cover + strong scrim so body text stays readable.
                Box(modifier = Modifier.fillMaxSize()) {
                    coil.compose.AsyncImage(
                        model =
                            coil.request.ImageRequest.Builder(context)
                                .data(bgImageUri)
                                .crossfade(true)
                                .build(),
                        contentDescription = null,
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        alpha = if (darkTheme) 0.22f else 0.28f,
                    )
                    Box(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .background(
                                    MaterialTheme.colorScheme.background.copy(
                                        alpha = if (darkTheme) 0.78f else 0.72f,
                                    ),
                                ),
                    )
                }
            }
        }
        CompositionLocalProvider(
            LocalMobilePermissionRequester provides permissions.requestAllAppPermissions,
            LocalMobileApiBaseUrl provides apiRootUrl,
        ) {
    Row(modifier = Modifier.fillMaxSize()) {
            TabHostSideRail(
                isAuthenticated = shell.isAuthenticated,
                useNavigationRail = windowLayout.useNavigationRail,
                currentRoute = currentRoute,
                profileUpdateAvailable = profileState.appUpdate.updateAvailable,
                chrome = tabHostChrome,
                navBarContainerColor = navBarContainerColor,
                navBarBorderColor = navBarBorderColor,
                surfaceStyle = surfaceStyle,
                navController = navController,
                hapticView = hapticView,
                reduceMotion = reduceMotion,
            )
            Scaffold(
            modifier = Modifier.weight(1f),
            containerColor = scaffoldContainerColor,
            bottomBar = {
                TabHostBottomBar(
                    isAuthenticated = shell.isAuthenticated,
                    hideBottomBarForKeyboard = hideBottomBarForKeyboard,
                    useBottomNavigation = windowLayout.useBottomNavigation,
                    currentRoute = currentRoute,
                    profileUpdateAvailable = profileState.appUpdate.updateAvailable,
                    chrome = tabHostChrome,
                    mediaPlaybackState = mediaPlaybackState,
                    navBarContainerColor = navBarContainerColor,
                    navBarBorderColor = navBarBorderColor,
                    surfaceStyle = surfaceStyle,
                    navController = navController,
                    hapticView = hapticView,
                    reduceMotion = reduceMotion,
                )
            },
            snackbarHost = {
                SnackbarHost(hostState = snackbarHostState) { data ->
                    Snackbar(
                        snackbarData = data,
                        shape = RoundedCornerShape(18.dp),
                        containerColor = MaterialTheme.colorScheme.inverseSurface.copy(alpha = 0.94f),
                        contentColor = MaterialTheme.colorScheme.inverseOnSurface,
                        actionColor = MaterialTheme.colorScheme.primaryContainer,
                    )
                }
            },
        ) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                TunnelShellConnectivityBanners(
                    state = tunnel,
                    isAuthenticated = shell.isAuthenticated,
                    socketLifecycle = socketLifecycle,
                    pendingMutations = vm.pendingMutationCount(),
                )
                MobilePermissionShellBanners(
                    isAuthenticated = shell.isAuthenticated,
                    state = permissions,
                )
                if (isOnline && perimeterState.requiresManualYandexAuth() && !profileState.trustedDeviceBinding.serverBound) {
                    PerimeterManualAuthBanner(
                        autoRenewFailed = perimeterState.autoRenewFailed,
                        renewing = perimeterState.status == PerimeterAccessStatus.Renewing,
                        onSignInWithYandex = vm::requestManualPerimeterAuth,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                GafVideoCallActiveCallBanner(
                    gafVideoCall = gafVideoCall,
                    eliteEwNetworkAvailable = eliteEwNetworkAvailable,
                    currentRoute = currentRoute,
                    navController = navController,
                    onReturnToActiveCall = vm::returnToActiveGafVideoCall,
                    onEndCall = vm::endActiveGafVideoCall,
                )
                Box(modifier = Modifier.fillMaxSize()) {
                    AuthSessionGate(
                        shell = shell,
                        perimeterAccess = perimeterState,
                        biometricPromptInFlight = biometricPromptInFlight,
                        onBiometricUnlockRequest = onBiometricUnlockRequest,
                        onStartLogin = {
                            vm.clearAuthError()
                            runCatching {
                                launchSsoLoginPlan(vm.prepareSsoLoginLaunchPlan())
                            }.onFailure { err ->
                                MobileTelemetry.reportError(err, "prepareSsoLoginLaunchPlan failed")
                                vm.onSsoLoginCanceled()
                                vm.setAuthError(
                                    err.message ?: context.getString(R.string.app_auth_oidc_start_failed),
                                )
                            }
                        },
                        onClearAuthError = vm::clearAuthError,
                        onDismissSessionReplaceConfirm = vm::dismissSessionReplaceConfirm,
                        onConfirmSessionReplace = {
                            runCatching {
                                launchSsoLoginPlan(vm.confirmSessionReplaceAndPrepareLogin())
                            }.onFailure { err ->
                                MobileTelemetry.reportError(err, "confirmSessionReplace login failed")
                                vm.dismissSessionReplaceConfirm()
                                vm.setAuthError(
                                    err.message ?: context.getString(R.string.app_auth_oidc_start_failed),
                                )
                            }
                        },
                        onSignInYandexPerimeter = vm::requestManualPerimeterAuth,
                        ssoBrowserChoiceRequest = ssoBrowserChoiceRequest,
                        onSsoBrowserSelected = { packageName ->
                            val callback = ssoBrowserChoiceOnResult
                            ssoBrowserChoiceRequest = null
                            ssoBrowserChoiceOnResult = null
                            callback?.invoke(MobileSsoBrowserChoiceResult.Selected(packageName))
                        },
                        onSsoBrowserDismissed = {
                            val callback = ssoBrowserChoiceOnResult
                            ssoBrowserChoiceRequest = null
                            ssoBrowserChoiceOnResult = null
                            callback?.invoke(MobileSsoBrowserChoiceResult.Canceled)
                        },
                        authenticatedContent = {
                            TabHostAuthenticatedNav(
                                navController = navController,
                                chrome = tabHostChrome,
                                shell = shell,
                                mainVm = vm,
                                feedVm = feedVm,
                                notificationsVm = notificationsVm,
                                profileVm = profileVm,
                                friendsVm = friendsVm,
                                desktopHubVm = desktopHubVm,
                                ugsVm = ugsVm,
                                feedState = feedState,
                                notificationsState = notificationsState,
                                profileState = profileState,
                                friendsState = friendsState,
                                desktopHubState = desktopHubState,
                                ugsState = ugsState,
                                chatState = chatState,
                                socketLifecycle = socketLifecycle,
                                apiRootUrl = apiRootUrl,
                                feedAuthorizedHttpClient = feedAuthorizedHttpClient,
                                privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
                                postNotificationsGranted = permissions.postNotificationsGranted,
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
                                onStartPrivateTunnel = {
                                    vm.prepareForPrivateTunnelNetworkCutover()
                                    val permissionIntent = profileVm.privateTunnelPermissionIntent()
                                    if (permissionIntent != null) {
                                        privateTunnelPermissionLauncher.launch(permissionIntent)
                                    } else {
                                        profileVm.startPrivateTunnel(
                                            onCompleted = onPrivateTunnelNetworkCutover,
                                        )
                                    }
                                },
                                requestNotificationPermission = permissions.requestNotificationPermission,
                                mobileProfileSync = mobileProfileSync,
                            )
                        }

                    )
                }
            }
        }
        }
        if (shell.isAuthenticated) {
            TabHostEwHubAndMediaOverlays(
                isAuthenticated = true,
                chrome = tabHostChrome,
                mediaPlaybackState = mediaPlaybackState,
                favoriteTrackIds = favoriteTrackIds,
                favoriteTracks = favoriteTracks,
                favoritesLoading = favoritesLoading,
            )
            GafVideoCallOverlayHost(
                isAuthenticated = true,
                gafGroupCallPicker = gafGroupCallPicker,
                incomingGafVideoCall = incomingGafVideoCall,
                outgoingGafVideoCall = outgoingGafVideoCall,
                onDismissGroupPicker = vm::dismissGafGroupVideoCallPicker,
                onConfirmGroupCall = { additionalIds ->
                    gafGroupCallPicker?.let { picker ->
                        vm.startGafGroupVideoCallFromChat(picker.chatId, additionalIds)
                    }
                },
                onAcceptIncoming = vm::acceptIncomingGafVideoCall,
                onDeclineIncoming = vm::declineIncomingGafVideoCall,
                onCancelOutgoing = vm::cancelOutgoingGafVideoCall,
            )
        }
        }
    }

    LaunchedEffect(currentRoute) {
        MobileTelemetry.trackScreen(MobileRouteRegistry.telemetryRouteName(currentRoute))
    }
}
