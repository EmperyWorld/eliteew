/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single-activity entry: OAuth/deeplink intent handling, biometric coordinator, theme locals,
 * and setContent → [MobileRoot]. Compose shell hosts live under shell/.
 *
 * Invariants:
 * - Deeplink parsing stays in MobileDeepLinks (T17); apply path is TabHostShellNavigationEffect.
 * - OAuth callback URI parsing stays in this Activity (not moved to shell hosts).
 * - One Activity-owned biometric coordinator drives the optional privacy prompt.
 * - VPN / SSO launchers register inside MobileRoot composition; tunnel gates stay in TunnelShellBridge.
 * - Premium splash must not compose MobileRoot underneath VideoView (UI-thread jank).
 *
 * Related:
 * - shell/MobileRootScaffoldHost.kt, MobilePermissionShell.kt, TabHostCoordinator,
 *   TunnelShellBridge.kt, AuthSessionGate.kt, GafVideoCallOverlayHost.kt,
 *   PremiumSplashGate.kt, MOBILE-ANDROID-ADAPTIVE-LAYOUT.md
 */
package world.empery.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Density
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import feature.chat.ChatVisualStrategy
import feature.chat.GafMeetWebViewLauncher
import feature.chat.LocalChatStyle
import feature.profile.MobileUiScalePreferences
import feature.profile.MobileUiStyle
import feature.profile.MobileUiStylePreferences
import world.empery.mobile.core.ui.ChatTypographyPreferences
import world.empery.mobile.core.ui.LocalChatTypography
import world.empery.mobile.core.ui.LocalChatVisualStyle
import world.empery.mobile.core.ui.LocalMobileSurfaceStyle
import world.empery.mobile.core.ui.LocalMobileUiScale
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileUiScaleComposer
import world.empery.mobile.core.ui.MobileWindowOrientationPolicy
import world.empery.mobile.core.ui.ChatVisualStylePreferences
import world.empery.mobile.core.ui.clampCompositeFontScale
import world.empery.mobile.core.ui.rememberMobileWindowLayout
import world.empery.mobile.perimeter.PerimeterAccessNotificationHelper
import world.empery.mobile.push.NotificationHelper
import world.empery.mobile.security.AppBiometricUnlockGate
import world.empery.mobile.security.BiometricAuthCoordinator
import world.empery.mobile.security.BiometricPromptRequest
import world.empery.mobile.shell.MobileRouteRegistry
import world.empery.mobile.tabs.DesktopHubTabViewModel
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel
import world.empery.mobile.tabs.UgsHubTabViewModel
import world.empery.mobile.theme.EmperyMobileTheme
import world.empery.mobile.ui.PremiumSplashGate
import world.empery.mobile.ui.PremiumSplashScreen
import world.empery.mobile.vr.EmperyHandEmbed

private const val MAIN_ACTIVITY_TAG = "MainActivity"

class MainActivity : FragmentActivity() {
    private val vm: MainViewModel by viewModels()
    private val feedVm: FeedTabViewModel by viewModels()
    private val notificationsVm: NotificationsTabViewModel by viewModels()
    private val profileVm: ProfileTabViewModel by viewModels()
    private val friendsVm: FriendsTabViewModel by viewModels {
        (application as MobileApp).container.friendsViewModelFactory
    }
    private val desktopHubVm: DesktopHubTabViewModel by viewModels()
    private val ugsVm: UgsHubTabViewModel by viewModels()
    private lateinit var biometricAuthCoordinator: BiometricAuthCoordinator
    private var biometricPromptInFlight by mutableStateOf(false)
    private val meetUserLeftReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                if (intent?.action != GafMeetWebViewLauncher.ACTION_GAF_MEET_USER_LEFT) return
                val callId = intent.getStringExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID).orEmpty()
                val active = vm.gafVideoCallOverlay.value ?: return
                if (callId.isNotBlank() && callId != active.callId) return
                Log.i(TAG, "GAF meet WebView closed by user; ending active call")
                vm.endActiveGafVideoCall()
            }
        }

    private val meetCallEndedReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                if (intent?.action != GafMeetWebViewLauncher.ACTION_GAF_MEET_CALL_ENDED) return
                val callId = intent.getStringExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID).orEmpty()
                val chatId = intent.getStringExtra(GafMeetWebViewLauncher.EXTRA_CHAT_ID)
                val duration = intent.getLongExtra(GafMeetWebViewLauncher.EXTRA_DURATION_SECONDS, 0L)
                if (callId.isBlank()) return
                vm.onGafMeetCallEnded(callId, chatId, duration)
            }
        }

    private var handEmbedPanelId: String? = null

    private val handEmbedReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                if (intent == null || !EmperyHandEmbed.shouldHandle(intent, handEmbedPanelId)) {
                    return
                }
                when (intent.action) {
                    EmperyHandEmbed.ACTION_UPDATE_BOUNDS ->
                        EmperyHandEmbed.applyWindow(
                            this@MainActivity,
                            intent.getIntExtra(EmperyHandEmbed.EXTRA_X, 0),
                            intent.getIntExtra(EmperyHandEmbed.EXTRA_Y, 0),
                            intent.getIntExtra(EmperyHandEmbed.EXTRA_WIDTH, 480),
                            intent.getIntExtra(EmperyHandEmbed.EXTRA_HEIGHT, 640),
                        )
                    EmperyHandEmbed.ACTION_HIDE -> finish()
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        if (EmperyHandEmbed.isHandEmbed(intent)) {
            setTheme(R.style.Theme_EmperyMobile_HandEmbed)
        } else {
            installSplashScreen()
        }
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        biometricAuthCoordinator =
            BiometricAuthCoordinator(
                promptDriver = AppBiometricUnlockGate(this),
                onStateChanged = { state ->
                    biometricPromptInFlight = state is BiometricAuthCoordinator.State.Prompting
                },
                onEffect = vm::handleBiometricAuthEffect,
                onError = { stage, error ->
                    Log.e(MAIN_ACTIVITY_TAG, stage, error)
                },
            )
        lifecycle.addObserver(biometricAuthCoordinator)
        if (EmperyHandEmbed.isHandEmbed(intent)) {
            handEmbedPanelId = EmperyHandEmbed.panelId(intent)
            EmperyHandEmbed.applyWindowFromIntent(this, intent)
            val filter =
                IntentFilter().apply {
                    addAction(EmperyHandEmbed.ACTION_UPDATE_BOUNDS)
                    addAction(EmperyHandEmbed.ACTION_HIDE)
                }
            ContextCompat.registerReceiver(
                this,
                handEmbedReceiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED,
            )
        }
        MobileWindowOrientationPolicy.apply(this)
        LocalBroadcastManager.getInstance(this).registerReceiver(
            meetUserLeftReceiver,
            IntentFilter(GafMeetWebViewLauncher.ACTION_GAF_MEET_USER_LEFT),
        )
        LocalBroadcastManager.getInstance(this).registerReceiver(
            meetCallEndedReceiver,
            IntentFilter(GafMeetWebViewLauncher.ACTION_GAF_MEET_CALL_ENDED),
        )
        handleIncomingIntent(intent, vm)
        setContent {
            var mobileUiStyle by remember {
                mutableStateOf(MobileUiStylePreferences.get(this@MainActivity))
            }
            var mobileColorMode by remember {
                mutableStateOf(MobileUiStylePreferences.getColorMode(this@MainActivity))
            }
            var mobileUiScale by remember {
                mutableStateOf(MobileUiScalePreferences.get(this@MainActivity))
            }
            var chatVisualStyle by remember {
                mutableStateOf(ChatVisualStylePreferences.get(this@MainActivity))
            }
            var chatTypography by remember {
                mutableStateOf(ChatTypographyPreferences.get(this@MainActivity))
            }
            val chatVisualStrategy =
                remember(chatVisualStyle) {
                    ChatVisualStrategy.resolve(chatVisualStyle)
                }
            val effectiveUiScale =
                remember(mobileUiScale) {
                    MobileUiScaleComposer.composePhoneOnly(phoneScale = mobileUiScale)
                }
            val windowLayout = rememberMobileWindowLayout()
            val systemDarkTheme = isSystemInDarkTheme()
            val darkTheme = mobileColorMode.resolveDark(systemDarkTheme)
            var showLogoutConfirm by remember { mutableStateOf(false) }
            var showDeeplinkRecovery by remember { mutableStateOf(false) }
            var showPremiumSplash by remember {
                mutableStateOf(
                    !EmperyHandEmbed.isHandEmbed(intent) &&
                        PremiumSplashGate.shouldShowOverlay(
                            this@MainActivity,
                            BuildConfig.VERSION_CODE,
                        ),
                )
            }
            val deeplinkRecoveryFlag by vm.deeplinkRecovery.collectAsStateWithLifecycle(initialValue = false)
            LaunchedEffect(deeplinkRecoveryFlag) {
                if (deeplinkRecoveryFlag) showDeeplinkRecovery = true
            }

            fun openExternalUrl(url: String) {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }

            val baseDensity = LocalDensity.current
            CompositionLocalProvider(
                LocalDensity provides Density(
                    density = baseDensity.density * effectiveUiScale.layoutDensityFactor,
                    fontScale =
                        clampCompositeFontScale(
                            baseDensity.fontScale * effectiveUiScale.textFontScaleFactor,
                        ),
                ),
                LocalMobileUiScale provides mobileUiScale,
                LocalChatVisualStyle provides chatVisualStyle,
                LocalChatTypography provides chatTypography,
                LocalChatStyle provides chatVisualStrategy,
                LocalMobileSurfaceStyle provides mobileUiStyle.toSurfaceStyle(),
                LocalMobileWindowLayout provides windowLayout,
            ) {
                AnimatedContent(
                    targetState = mobileUiStyle,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "mobile_theme_crossfade",
                ) { style ->
                    EmperyMobileTheme(mobileStyle = style, darkTheme = darkTheme) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            // Cause: mounting full shell under VideoView caused ~90% janky frames
                            // and UI-thread stalls for the whole ~5s splash. Defer MobileRoot.
                            if (showPremiumSplash) {
                                PremiumSplashScreen(
                                    onFinished = {
                                        PremiumSplashGate.markOverlayShown(
                                            this@MainActivity,
                                            BuildConfig.VERSION_CODE,
                                        )
                                        showPremiumSplash = false
                                    },
                                )
                            } else {
                                MobileRoot(
                                    vm = vm,
                                    feedVm = feedVm,
                                    notificationsVm = notificationsVm,
                                    profileVm = profileVm,
                                    friendsVm = friendsVm,
                                    desktopHubVm = desktopHubVm,
                                    ugsVm = ugsVm,
                                    onOpenUrl = { url -> openExternalUrl(url) },
                                    mobileUiStyle = mobileUiStyle,
                                    displayMobileUiStyle = style,
                                    mobileColorMode = mobileColorMode,
                                    mobileUiScale = mobileUiScale,
                                    chatVisualStyle = chatVisualStyle,
                                    chatTypography = chatTypography,
                                    darkTheme = darkTheme,
                                    onMobileUiStyleChange = { next ->
                                        MobileUiStylePreferences.set(this@MainActivity, next)
                                        mobileUiStyle = next
                                    },
                                    onMobileColorModeChange = { next ->
                                        MobileUiStylePreferences.setColorMode(this@MainActivity, next)
                                        mobileColorMode = next
                                    },
                                    onMobileUiScaleChange = { next ->
                                        MobileUiScalePreferences.set(this@MainActivity, next)
                                        mobileUiScale = next
                                    },
                                    onChatVisualStyleChange = { next ->
                                        ChatVisualStylePreferences.set(this@MainActivity, next)
                                        chatVisualStyle = next
                                    },
                                    onChatTypographyChange = { next ->
                                        ChatTypographyPreferences.set(this@MainActivity, next)
                                        chatTypography = next
                                    },
                                    biometricPromptInFlight = biometricPromptInFlight,
                                    onBiometricUnlockRequest = {
                                        biometricAuthCoordinator.authenticate(
                                            BiometricPromptRequest(
                                                title = getString(R.string.app_biometric_unlock_title),
                                                subtitle = getString(R.string.app_biometric_unlock_subtitle),
                                                negativeButtonText =
                                                    getString(R.string.app_biometric_unlock_cancel),
                                            ),
                                        )
                                    },
                                    onLogoutRequest = { showLogoutConfirm = true },
                                )
                            }
                        }
                    }
                }
            }

            if (showDeeplinkRecovery) {
                AlertDialog(
                    onDismissRequest = { showDeeplinkRecovery = false },
                    title = { Text(stringResource(R.string.deeplink_recovery_title)) },
                    text = { Text(stringResource(R.string.deeplink_recovery_body)) },
                    confirmButton = {
                        TextButton(onClick = { showDeeplinkRecovery = false }) {
                            Text(stringResource(android.R.string.ok))
                        }
                    },
                )
            }

            if (showLogoutConfirm) {
                LogoutConfirmDialog(
                    onConfirm = {
                        showLogoutConfirm = false
                        vm.logout()
                    },
                    onDismiss = { showLogoutConfirm = false },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        vm.bindPerimeterActivityContext(this)
        vm.onActivityResumedForPerimeter()
    }

    override fun onPause() {
        vm.clearPerimeterActivityContext()
        super.onPause()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        MobileWindowOrientationPolicy.apply(this, newConfig)
    }

    override fun onDestroy() {
        if (::biometricAuthCoordinator.isInitialized) {
            biometricAuthCoordinator.destroy()
        }
        if (handEmbedPanelId != null) {
            try {
                unregisterReceiver(handEmbedReceiver)
            } catch (_: IllegalArgumentException) {
            }
        }
        LocalBroadcastManager.getInstance(this).unregisterReceiver(meetUserLeftReceiver)
        LocalBroadcastManager.getInstance(this).unregisterReceiver(meetCallEndedReceiver)
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (EmperyHandEmbed.isHandEmbed(intent)) {
            handEmbedPanelId = EmperyHandEmbed.panelId(intent)
            EmperyHandEmbed.applyWindowFromIntent(this, intent)
        }
        handleIncomingIntent(intent, vm)
    }

    /**
     * SSO redirect and optional product deep links share the app’s custom URI scheme.
     * Only the configured OAuth redirect path is treated as a login callback.
     */
    private fun handleIncomingIntent(intent: Intent?, vm: MainViewModel) {
        if (intent?.action == PerimeterAccessNotificationHelper.ACTION_RENEW_PERIMETER) {
            vm.handlePerimeterRenewIntent()
            return
        }

        val routeExtra = intent?.getStringExtra(MobileDeepLinks.EXTRA_NAV_ROUTE)?.trim()?.lowercase()
        val ewDeskFromExtra =
            MobileDeepLinks.coerceEwDeskPostId(intent?.getStringExtra(MobileDeepLinks.EXTRA_EWDESK_POST_ID))
        val friendRequestFromExtra =
            MobileDeepLinks.coerceFriendRequestId(intent?.getStringExtra(MobileDeepLinks.EXTRA_FRIEND_REQUEST_ID))
        val friendUserFromExtra =
            MobileDeepLinks.coerceFriendUserId(intent?.getStringExtra(MobileDeepLinks.EXTRA_FRIEND_USER_ID))
        val friendsFocusFromExtra =
            MobileDeepLinks.normalizeFriendsFocus(intent?.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS))
        val notificationIdFromExtra =
            MobileDeepLinks.coerceNotificationId(intent?.getStringExtra(MobileDeepLinks.EXTRA_NOTIFICATION_ID))
        val chatIdFromExtra =
            MobileDeepLinks.coerceChatId(intent?.getStringExtra(MobileDeepLinks.EXTRA_CHAT_ID))
        val socialHubInboxItemFromExtra =
            MobileDeepLinks.coerceSocialHubInboxItemId(
                intent?.getStringExtra(MobileDeepLinks.EXTRA_SOCIAL_HUB_INBOX_ITEM_ID),
            )
        val profileSectionFromExtra =
            MobileDeepLinks.coerceProfileSection(intent?.getStringExtra(MobileDeepLinks.EXTRA_PROFILE_SECTION))
        val ugsNestedRouteFromExtra =
            coerceUgsNestedRoute(intent?.getStringExtra(MobileDeepLinks.EXTRA_UGS_NESTED_ROUTE))
        val friendsNestedRouteFromExtra =
            coerceFriendsNestedRoute(intent?.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_NESTED_ROUTE))
                ?: coerceFriendsNestedRoute(intent?.getStringExtra(MobileDeepLinks.EXTRA_UGS_NESTED_ROUTE))
        val desktopHubSectionFromExtra =
            MobileDeepLinks.coerceDesktopHubSection(intent?.getStringExtra(MobileDeepLinks.EXTRA_DESKTOP_HUB_SECTION))
        val incomingCallId = intent?.getStringExtra(NotificationHelper.EXTRA_INCOMING_CALL_ID)?.trim().orEmpty()
        val incomingChatId = intent?.getStringExtra(NotificationHelper.EXTRA_INCOMING_CHAT_ID)?.trim()?.ifBlank { null }
        if (incomingCallId.isNotBlank()) {
            val autoAccept = intent?.getBooleanExtra(NotificationHelper.EXTRA_AUTO_ACCEPT_CALL, false) == true
            vm.presentIncomingGafVideoCallFromPush(
                incomingCallId,
                incomingChatId,
                getString(R.string.app_gaf_video_call_default),
                autoAccept = autoAccept,
            )
            intent?.removeExtra(NotificationHelper.EXTRA_INCOMING_CALL_ID)
            intent?.removeExtra(NotificationHelper.EXTRA_INCOMING_CHAT_ID)
            intent?.removeExtra(NotificationHelper.EXTRA_AUTO_ACCEPT_CALL)
        }

        if (!routeExtra.isNullOrBlank()) {
            feature.desktop.resolveEmbeddedSpaHashFromIncomingTab(routeExtra)?.let { spaHash ->
                vm.requestEmbeddedSpaDeepLink(
                    feature.desktop.PendingEmbeddedSpaDeepLink(
                        spaHash = spaHash,
                        hashQuery =
                            intent?.getStringExtra(MobileDeepLinks.EXTRA_EMBEDDED_SPA_HASH_QUERY),
                    ),
                )
                intent.removeExtra(MobileDeepLinks.EXTRA_NAV_ROUTE)
                intent.removeExtra(MobileDeepLinks.EXTRA_EMBEDDED_SPA_HASH_QUERY)
                return
            }
            val postId = ewDeskFromExtra?.takeIf { routeExtra == "feed" }
            val navIntent = MobileDeepLinks.shellNavigationIntentForIncomingTab(routeExtra)
            if (navIntent != null) {
                val friendsNav = MobileDeepLinks.isFriendsNavIncomingTab(routeExtra)
                val notificationsNav = routeExtra == "notifications" || navIntent.tabRoute == "notifications"
                val chatNav = routeExtra == "chat" || navIntent.tabRoute == "chat"
                val profileNav = routeExtra == "profile" || navIntent.tabRoute == "profile"
                val ugsNav = routeExtra == "ugs" || routeExtra == "desktop" || navIntent.tabRoute == "ugs"
                val friendsFocusResolved =
                    friendsFocusFromExtra?.takeIf { friendsNav }
                        ?: navIntent.friendsFocus?.takeIf { friendsNav }
                val friendsNestedResolved =
                    friendsNestedRouteFromExtra?.takeIf { friendsNav }
                        ?: when {
                            friendsFocusResolved == "action_center" -> FRIENDS_ACTION_CENTER_ROUTE
                            else -> null
                        }
                vm.requestShellNavigation(
                    navIntent.copy(
                        ewDeskPostId = postId,
                        friendRequestId = friendRequestFromExtra?.takeIf { friendsNav },
                        friendUserId = friendUserFromExtra?.takeIf { friendsNav },
                        friendsFocus = friendsFocusResolved,
                        notificationId = notificationIdFromExtra?.takeIf { notificationsNav },
                        chatId = chatIdFromExtra?.takeIf { chatNav },
                        profileSection = profileSectionFromExtra?.takeIf { profileNav },
                        socialHubInboxItemId = socialHubInboxItemFromExtra?.takeIf { friendsNav },
                        nestedRoute =
                            ugsNestedRouteFromExtra?.takeIf { ugsNav }
                                ?: friendsNestedResolved
                                ?: navIntent.nestedRoute?.takeIf { ugsNav || friendsNav },
                        desktopHubSection =
                            desktopHubSectionFromExtra?.takeIf { ugsNav },
                    ),
                )
            }
            intent.removeExtra(MobileDeepLinks.EXTRA_NAV_ROUTE)
            intent.removeExtra(MobileDeepLinks.EXTRA_EWDESK_POST_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_FRIEND_REQUEST_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_FRIEND_USER_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS)
            intent.removeExtra(MobileDeepLinks.EXTRA_NOTIFICATION_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_CHAT_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_PROFILE_SECTION)
            intent.removeExtra(MobileDeepLinks.EXTRA_SOCIAL_HUB_INBOX_ITEM_ID)
            intent.removeExtra(MobileDeepLinks.EXTRA_UGS_NESTED_ROUTE)
            intent.removeExtra(MobileDeepLinks.EXTRA_FRIENDS_NESTED_ROUTE)
            intent.removeExtra(MobileDeepLinks.EXTRA_DESKTOP_HUB_SECTION)
        }

        val data = intent?.data ?: return
        val config = AppRuntimeConfig.from(this)
        if (!isOAuthCallbackUri(data, config)) {
            MobileDeepLinks.parseEmbeddedSpaDeepLink(data, config.keycloakRedirectUri)?.let { link ->
                vm.requestEmbeddedSpaDeepLink(link)
                return
            }
            MobileDeepLinks.parseLegacyTabQuery(data)?.let { legacy ->
                vm.requestShellNavigation(legacy)
                return
            }
            val consumed = MobileDeepLinks.consumeNavUri(data, config.keycloakRedirectUri) { nav ->
                vm.requestShellNavigation(nav)
            }
            if (!consumed) {
                val target = MobileDeepLinks.routeViaRouter(data, config.keycloakRedirectUri)
                if (target is MobileDeepLinkTarget.Invalid) {
                    vm.requestShellNavigation(
                        ShellNavigationIntent(tabRoute = MobileRouteRegistry.defaultStartRoute),
                    )
                    vm.signalDeeplinkRecovery()
                }
            }
            return
        }

        val authError = data.getQueryParameter("error")
        if (!authError.isNullOrBlank()) {
            // Never surface raw OIDC error_description to the user — map to localized copy.
            vm.setAuthError(getString(R.string.app_auth_callback_error_user))
            return
        }

        val code = data.getQueryParameter("code")
        val state = data.getQueryParameter("state")
        if (!code.isNullOrBlank()) {
            vm.completeSsoLoginFromCallback(code = code, state = state)
        } else {
            vm.setAuthError(getString(R.string.app_auth_server_no_code))
        }
    }

    private fun isOAuthCallbackUri(candidate: Uri, config: AppRuntimeConfig): Boolean {
        val redirect = Uri.parse(config.keycloakRedirectUri)
        if (candidate.scheme != redirect.scheme) return false
        val cPath = oauthPathKey(candidate)
        val rPath = oauthPathKey(redirect)
        return cPath.isNotEmpty() && cPath == rPath
    }

    /** AppAuth-style URIs like `world.empery.mobile.dev:/oauth2redirect` are often opaque; [Uri.getPath] may be empty. */
    private fun oauthPathKey(uri: Uri): String {
        val path = uri.path?.trim('/')?.takeIf { it.isNotEmpty() }
        if (path != null) return path
        val ssp = uri.schemeSpecificPart ?: return ""
        return ssp.substringBefore('?').substringBefore('#').trimStart('/').trimEnd('/')
    }

    private companion object {
        private const val TAG = "MainActivity"
    }
}
