/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile tab NavHost destination for TabHostAuthenticatedNav (session, tunnel,
 * UI prefs, diagnostics). Extracted from TabHostNavGraph (Hardened residual).
 *
 * Invariants:
 * - Route string [RootTab.Profile] stays identical to pre-split TabHostNavGraph.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - TabHostNavGraph.kt, MobileBackStackPolicy.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0 Hardened residual
 */
package world.empery.mobile

import android.content.Context
import androidx.compose.runtime.remember
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import feature.notifications.MobileNotificationPreferences
import feature.notifications.openNotificationSettings
import feature.profile.MobileBatteryOptimizationSupport
import feature.profile.MobileColorMode
import feature.profile.MobileUiScale
import feature.profile.MobileUiStyle
import feature.profile.MobileUiStylePreferences
import feature.profile.ProfileAccessibilityPreferences
import feature.profile.ProfileScreen
import feature.profile.PushDiagnosticsUiState
import feature.profile.RuntimeDiagnosticsUiRow
import feature.profile.RuntimeDiagnosticsUiState
import world.empery.mobile.BuildConfig
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.MobileFeatureShellPreferences
import world.empery.mobile.shell.RootTab
import world.empery.mobile.shell.buildRuntimeDiagnosticsRows
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel

internal fun NavGraphBuilder.tabHostProfileRoutes(
    navController: NavHostController,
    context: Context,
    mobileApp: MobileApp,
    chrome: TabHostChromeState,
    shell: MobileShellUiState,
    mainVm: MainViewModel,
    profileVm: ProfileTabViewModel,
    friendsVm: FriendsTabViewModel,
    profileState: feature.profile.ProfileUiState,
    socketLifecycle: SocketLifecycleState,
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
    composable(RootTab.Profile.route) {
        RefreshableRoute(
            isRefreshing = profileState.isLoading,
            onRefresh = profileVm::refresh,
        ) {
            ProfileScreen(
                state = profileState,
                onRefresh = profileVm::refresh,
                onLogout = onLogoutRequest,
                sessionHealth =
                    mainVm.sessionHealthState(
                        profileDisplayName = profileState.profile?.fullName ?: profileState.profile?.username,
                        profileEmail = profileState.profile?.email,
                    ).copy(socketLifecycle = socketLifecycle),
                onOpenAccessGate = {
                    onOpenUrl("https://access.eliteew.ru/")
                },
                appSessionActive = shell.isAuthenticated,
                biometricUnlockEnabled = shell.biometricUnlockEnabled,
                biometricUnlockAvailable =
                    world.empery.mobile.security.AppBiometricUnlockGate.canAuthenticate(context),
                onBiometricUnlockEnabledChange = mainVm::setBiometricUnlockEnabled,
                onRenewPerimeterAccess = profileVm::renewPerimeterAccess,
                onCheckPerimeterAccess = profileVm::checkPerimeterAccess,
                onPerimeterAutoRenewChange = profileVm::setPerimeterAutoRenew,
                onImportPrivateTunnelConfig = profileVm::importPrivateTunnelConfig,
                onStartPrivateTunnel = onStartPrivateTunnel,
                onStopPrivateTunnel = profileVm::stopPrivateTunnel,
                onClearPrivateTunnelConfig = profileVm::clearPrivateTunnelConfig,
                onPrivateTunnelConnectionModeChange = profileVm::setPrivateTunnelConnectionMode,
                onTrustedDevicePairingPayloadChange = profileVm::setTrustedDevicePairingPayload,
                onTrustedDevicePrepareGafE2eeChange = profileVm::setTrustedDevicePrepareGafE2ee,
                onBindTrustedDevice = profileVm::bindTrustedDevice,
                onRevokeTrustedDevice = profileVm::revokeTrustedDevice,
                onClearLocalTrustedDeviceBinding = profileVm::clearLocalTrustedDeviceBinding,
                onConfirmSecureConnectionAfterBind = profileVm::confirmSecureConnectionAfterBind,
                onDismissSecureConnectionConsent = profileVm::dismissSecureConnectionConsent,
                onTrustedDeviceSectionVisible = profileVm::onTrustedDeviceSectionVisible,
                notificationsEnabled = chrome.notificationsEnabled,
                onNotificationsEnabledChange = { enabled ->
                    MobileUiStylePreferences.setNotificationsEnabled(context, enabled)
                    chrome.setNotificationsEnabled(enabled)
                    mobileProfileSync.schedulePush()
                },
                callTarget =
                    remember(chrome.profilePrefsRevision) {
                        feature.profile.MobileProfileLocalStore.getCallTarget(context)
                    },
                callTargetSaving = profileState.isCallTargetSaving,
                callTargetError = profileState.callTargetError,
                onCallTargetChange = { next ->
                    profileVm.setCallTarget(next) { chrome.bumpProfilePrefsRevision() }
                },
                onCheckForUpdates = profileVm::checkForUpdates,
                onOneClickUpdate = profileVm::updateAppOneClick,
                mobileUiStyle = mobileUiStyle,
                onMobileUiStyleChange = { next ->
                    onMobileUiStyleChange(next)
                    mobileProfileSync.schedulePush()
                },
                mobileColorMode = mobileColorMode,
                onMobileColorModeChange = { next ->
                    onMobileColorModeChange(next)
                    mobileProfileSync.schedulePush()
                },
                mobileUiScale = mobileUiScale,
                onMobileUiScaleChange = { next ->
                    onMobileUiScaleChange(next)
                    mobileProfileSync.schedulePush()
                },
                chatVisualStyle = chatVisualStyle,
                onChatVisualStyleChange = { next ->
                    onChatVisualStyleChange(next)
                },
                chatTypography = chatTypography,
                onChatTypographyChange = { next ->
                    onChatTypographyChange(next)
                },
                onSavePrivacy = profileVm::savePrivacy,
                onBackgroundImageChanged = {
                    chrome.bumpWallpaperRevision()
                    mobileProfileSync.scheduleBackgroundWallpaperSync()
                },
                onUploadAvatar = profileVm::stageAvatarPreview,
                onConfirmAvatarUpload = profileVm::confirmAvatarUpload,
                onDismissAvatarPreview = profileVm::dismissAvatarPreview,
                onRemoveAvatar = profileVm::removeAvatar,
                onCancelDownload = profileVm::cancelDownload,
                onOtaInstallAborted = { profileVm.handleOtaInstallAborted() },
                onPauseDownload = profileVm::pauseDownload,
                onClearMediaCache = profileVm::clearMediaCache,
                onClearOfflineCache = profileVm::clearOfflineCache,
                onClearStreamCache = profileVm::clearStreamCache,
                onStreamCacheWifiOnlyChange = { enabled ->
                    profileVm.setStreamCacheWifiOnly(enabled)
                    mobileProfileSync.schedulePush()
                },
                onExportSupportBundle = profileVm::exportSupportBundle,
                onSubmitSupportReport = profileVm::submitSupportReportToServer,
                onSupportModeChange = profileVm::setSupportMode,
                onOpenFriendsPrivacyPreview = {
                    MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Friends.route)
                    friendsVm.showPrivacyWizard()
                },
                onOpenFeedbackHub = chrome.openEwHubFeedbackHub,
                onOpenNotificationCenter = chrome.openEwHubNotifications,
                reduceMotion =
                    remember(chrome.profilePrefsRevision) {
                        ProfileAccessibilityPreferences.isReduceMotion(context)
                    },
                highContrastHint =
                    remember(chrome.profilePrefsRevision) {
                        ProfileAccessibilityPreferences.isHighContrastHint(context)
                    },
                onReduceMotionChange = {
                    ProfileAccessibilityPreferences.setReduceMotion(context, it)
                    chrome.bumpProfilePrefsRevision()
                    mobileProfileSync.schedulePush()
                },
                onHighContrastChange = {
                    ProfileAccessibilityPreferences.setHighContrastHint(context, it)
                    chrome.bumpProfilePrefsRevision()
                    mobileProfileSync.schedulePush()
                },
                introSplashEnabled =
                    remember(chrome.profilePrefsRevision) {
                        ProfileAccessibilityPreferences.isIntroSplashEnabled(context)
                    },
                onIntroSplashEnabledChange = {
                    ProfileAccessibilityPreferences.setIntroSplashEnabled(context, it)
                    chrome.bumpProfilePrefsRevision()
                },
                onNotificationPreferencesChanged = { mobileProfileSync.schedulePush() },
                pushDiagnostics =
                    PushDiagnosticsUiState(
                        pushEnabled = chrome.notificationsEnabled,
                        postNotificationsGranted = postNotificationsGranted,
                        fcmToken = MobileNotificationPreferences.readCachedFcmToken(context),
                        socketLifecycle = socketLifecycle,
                        batteryOptimizationExempt =
                            MobileBatteryOptimizationSupport.isExempt(context),
                    ),
                onOpenNotificationSettings = { openNotificationSettings(context) },
                onRequestNotificationPermission = requestNotificationPermission,
                runtimeDiagnostics =
                    RuntimeDiagnosticsUiState(
                        rows =
                            buildRuntimeDiagnosticsRows(
                                flavor = BuildConfig.FLAVOR,
                                buildType = BuildConfig.BUILD_TYPE,
                                versionName = BuildConfig.VERSION_NAME,
                                versionCode = BuildConfig.VERSION_CODE,
                                apiRootHost = mobileApp.container.apiBaseUrl.trim().removePrefix("https://").substringBefore('/'),
                                socketState = socketLifecycle.name,
                                reduceMotion = reduceMotion,
                                fontStress = chrome.fontStressEnabled,
                                strictModeDebug = MobileFeatureShellPreferences.isStrictModeDebugEnabled(context),
                            ).map { RuntimeDiagnosticsUiRow(it.label, it.value, it.sensitive) },
                        expanded = chrome.runtimeDiagExpanded,
                        analyticsEnabled = chrome.analyticsEnabledPref,
                        fontStressEnabled = chrome.fontStressEnabled,
                    ),
                onRuntimeDiagnosticsExpandedChange = { expanded ->
                    chrome.setRuntimeDiagExpanded(expanded)
                    MobileFeatureShellPreferences.setRuntimeDiagnosticsExpanded(context, expanded)
                },
                onAnalyticsEnabledChange = { enabled ->
                    chrome.setAnalyticsEnabledPref(enabled)
                    MobileFeatureShellPreferences.setAnalyticsEnabled(context, enabled)
                },
                onFontStressChange = { enabled ->
                    chrome.setFontStressEnabled(enabled)
                    MobileFeatureShellPreferences.setA11yFontStressEnabled(context, enabled)
                },
                onExpandCategoryConsumed = profileVm::consumeExpandCategory,
            )
        }
    }
}
