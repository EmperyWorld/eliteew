/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ProfileScreen host: category accordion wiring for Security/Updates/Appearance/Support (W1 C4).
 *
 * Invariants:
 * - OTA updates: one primary action — check when up to date, one-click update when a build is available.
 * - Notifications settings: one card, one switch per category (no nested mute toggles).
 * - Appearance settings: one card with style chips, brightness/scale chips, wallpaper, comfort.
 * - User-visible strings use `feature.profile` string resources.
 *
 * Related:
 * - ProfileRepository, ProfileTabViewModel, ProfilePrivacySection.kt, MainActivity Profile tab
 */
package feature.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.BlurOn
import androidx.compose.material.icons.outlined.BrightnessAuto
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.VpnKey
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import java.io.File
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import world.empery.mobile.core.network.FriendCirclesProvider
import world.empery.mobile.core.network.api.MobilePushTokenBody
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.network.api.ProfileMeResponse
import androidx.compose.material.icons.outlined.Download
import world.empery.mobile.core.network.api.ProfilePrivacyDto
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.network.api.ProfilePrivacyUpdateBody
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.ProfileEntity
import okhttp3.MultipartBody
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import coil.request.ImageRequest
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.ui.LocalMobileApiBaseUrl
import world.empery.mobile.core.ui.MobileAvatarPlaceholder
import world.empery.mobile.core.ui.mobileAvatarInitials

@Composable
fun ProfileScreen(
    state: ProfileUiState,
    onRefresh: () -> Unit,
    onLogout: () -> Unit,
    onOpenAccessGate: () -> Unit = {},
    appSessionActive: Boolean = true,
    onRenewPerimeterAccess: () -> Unit = {},
    onCheckPerimeterAccess: () -> Unit = {},
    onPerimeterAutoRenewChange: (Boolean) -> Unit = {},
    onImportPrivateTunnelConfig: (String) -> Unit = {},
    onStartPrivateTunnel: () -> Unit = {},
    onStopPrivateTunnel: () -> Unit = {},
    onClearPrivateTunnelConfig: () -> Unit = {},
    onPrivateTunnelConnectionModeChange: (PrivateTunnelConnectionModeUi) -> Unit = {},
    onTrustedDevicePairingPayloadChange: (String) -> Unit = {},
    onTrustedDevicePrepareGafE2eeChange: (Boolean) -> Unit = {},
    onBindTrustedDevice: () -> Unit = {},
    onRevokeTrustedDevice: () -> Unit = {},
    onClearLocalTrustedDeviceBinding: () -> Unit = {},
    onConfirmSecureConnectionAfterBind: () -> Unit = {},
    onDismissSecureConnectionConsent: () -> Unit = {},
    onTrustedDeviceSectionVisible: () -> Unit = {},
    biometricUnlockEnabled: Boolean = false,
    biometricUnlockAvailable: Boolean = false,
    onBiometricUnlockEnabledChange: (Boolean) -> Unit = {},
    notificationsEnabled: Boolean = true,
    onNotificationsEnabledChange: (Boolean) -> Unit = {},
    callTarget: String = VideoCallTarget.BOTH,
    callTargetSaving: Boolean = false,
    callTargetError: String? = null,
    onCallTargetChange: (String) -> Unit = {},
    onCheckForUpdates: () -> Unit,
    onOneClickUpdate: () -> Unit,
    mobileUiStyle: MobileUiStyle = MobileUiStyle.SYSTEM,
    onMobileUiStyleChange: (MobileUiStyle) -> Unit = {},
    mobileColorMode: MobileColorMode = MobileColorMode.SYSTEM,
    onMobileColorModeChange: (MobileColorMode) -> Unit = {},
    mobileUiScale: MobileUiScale = MobileUiScale.COMPACT,
    onMobileUiScaleChange: (MobileUiScale) -> Unit = {},
    chatVisualStyle: ChatVisualStyle = ChatVisualStyle.STANDARD,
    onChatVisualStyleChange: (ChatVisualStyle) -> Unit = {},
    chatTypography: ChatTypographySettings = ChatTypographySettings.DEFAULT,
    onChatTypographyChange: (ChatTypographySettings) -> Unit = {},
    onSavePrivacy: (String, String, String?, String, String?, String, String?) -> Unit = { _, _, _, _, _, _, _ -> },
    onBackgroundImageChanged: () -> Unit = {},
    onUploadAvatar: (Uri) -> Unit = {},
    sessionHealth: SessionHealthUiState = SessionHealthUiState(),
    pushDiagnostics: PushDiagnosticsUiState = PushDiagnosticsUiState(),
    onOpenNotificationSettings: () -> Unit = {},
    onRequestNotificationPermission: () -> Unit = {},
    onCancelDownload: () -> Unit = {},
    onOtaInstallAborted: () -> Unit = {},
    onPauseDownload: () -> Unit = {},
    onClearMediaCache: () -> Unit = {},
    onClearOfflineCache: () -> Unit = {},
    onClearStreamCache: () -> Unit = {},
    onStreamCacheWifiOnlyChange: (Boolean) -> Unit = {},
    onExportSupportBundle: () -> Unit = {},
    onSubmitSupportReport: () -> Unit = {},
    onSupportModeChange: (Boolean) -> Unit = {},
    onRemoveAvatar: () -> Unit = {},
    onConfirmAvatarUpload: () -> Unit = {},
    onDismissAvatarPreview: () -> Unit = {},
    onOpenFriendsPrivacyPreview: () -> Unit = {},
    onOpenFeedbackHub: () -> Unit = {},
    onOpenNotificationCenter: () -> Unit = {},
    reduceMotion: Boolean = false,
    highContrastHint: Boolean = false,
    onReduceMotionChange: (Boolean) -> Unit = {},
    onHighContrastChange: (Boolean) -> Unit = {},
    introSplashEnabled: Boolean = true,
    onIntroSplashEnabledChange: (Boolean) -> Unit = {},
    onNotificationPreferencesChanged: () -> Unit = {},
    runtimeDiagnostics: RuntimeDiagnosticsUiState = RuntimeDiagnosticsUiState(),
    onRuntimeDiagnosticsExpandedChange: (Boolean) -> Unit = {},
    onAnalyticsEnabledChange: (Boolean) -> Unit = {},
    onFontStressChange: (Boolean) -> Unit = {},
    onExpandCategoryConsumed: () -> Unit = {},
) {
    val context = LocalContext.current
    val expandCategoryId = state.expandCategoryId
    var currentBg by remember {
        mutableStateOf(MobileUiStylePreferences.getBackgroundImage(context))
    }

    val avatarPicker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) {
                onUploadAvatar(uri)
            }
        }

    ProfileAvatarPreviewDialog(
        previewUri = state.avatarPreviewUri,
        compressInfo = state.avatarCompressInfo,
        isUploading = state.isAvatarUploading,
        onConfirm = onConfirmAvatarUpload,
        onRemove = onRemoveAvatar,
        onDismiss = onDismissAvatarPreview,
    )

    val bgPicker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) {
                val uriString = uri.toString()
                MobileUiStylePreferences.setBackgroundImage(context, uriString)
                currentBg = uriString
                onBackgroundImageChanged()
            }
        }

    val installPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            val apkPath = state.appUpdate.downloadedApkPath
            if (!apkPath.isNullOrBlank()) {
                val file = File(apkPath)
                if (file.exists() && MobileApkInstaller.canInstallPackages(context)) {
                    if (!MobileApkInstaller.launchInstall(context, file)) {
                        Toast.makeText(
                            context,
                            MobileAppUpdateMessages.installLaunchFailed(context),
                            Toast.LENGTH_LONG,
                        ).show()
                        onOtaInstallAborted()
                    }
                }
            }
        }

    val retryCd = stringResource(R.string.profile_retry_cd)
    val accessGateCd = stringResource(R.string.profile_access_gate_cd)
    val loadingCd = stringResource(R.string.profile_loading_cd)
    val notLoadedCd = stringResource(R.string.profile_not_loaded_cd)
    val chrome = rememberMobileScaleChromePolicy()
    state.avatarUploadError?.let { err ->
        LaunchedEffect(err) {
            Toast.makeText(context, err, Toast.LENGTH_LONG).show()
        }
    }

    val layout = LocalMobileWindowLayout.current
    val twoColumnCategories = layout.widthClass >= MobileWindowWidthClass.Expanded
    val appUpdate = state.appUpdate
    val updatesDefaultExpanded =
        appUpdate.updateAvailable ||
            appUpdate.isDownloading ||
            !appUpdate.downloadedApkPath.isNullOrBlank()
    val updatesBadge =
        if (appUpdate.updateAvailable && appUpdate.apkAvailable) {
            stringResource(R.string.profile_category_badge_new)
        } else {
            null
        }

    var activeCategoryId by rememberSaveable { mutableStateOf<ProfileCategoryId?>(null) }
    LaunchedEffect(expandCategoryId) {
        if (expandCategoryId != null) {
            activeCategoryId = expandCategoryId
        }
    }
    LaunchedEffect(updatesDefaultExpanded) {
        if (updatesDefaultExpanded && activeCategoryId == null) {
            activeCategoryId = ProfileCategoryId.UPDATES
        }
    }
    val onCategoryToggle: (ProfileCategoryId, Boolean) -> Unit = { id, expand ->
        activeCategoryId =
            when {
                expand -> id
                activeCategoryId == id -> null
                else -> activeCategoryId
            }
        ProfileCategoryPrefs.setExpanded(context, id, expand)
    }
    fun categoryExpanded(id: ProfileCategoryId): Boolean = activeCategoryId == id
    LaunchedEffect(categoryExpanded(ProfileCategoryId.SECURITY), appSessionActive) {
        if (appSessionActive && categoryExpanded(ProfileCategoryId.SECURITY)) {
            onTrustedDeviceSectionVisible()
        }
    }

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        contentPadding = PaddingValues(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(modifier = Modifier.height(4.dp)) }

        val profileError = state.error
        if (profileError != null) {
            item {
                val errDesc = stringResource(R.string.profile_error_cd, profileError)
                PremiumStateCard(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics(mergeDescendants = true) {
                                contentDescription = errDesc
                            },
                    title = stringResource(R.string.profile_error_title),
                    message = profileError,
                    icon = Icons.Outlined.Badge,
                    isError = true,
                    action = {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ProfileActionIconButton(
                                icon = Icons.Outlined.Refresh,
                                contentDescription = retryCd,
                                tint = Color(0xFFEAB308),
                                enabled = !state.isLoading,
                                isBusy = state.isLoading,
                                onClick = onRefresh,
                            )
                            ProfileActionIconButton(
                                icon = Icons.Outlined.OpenInBrowser,
                                contentDescription = accessGateCd,
                                tint = Color(0xFF16A34A),
                                enabled = true,
                                isBusy = false,
                                onClick = onOpenAccessGate,
                            )
                        }
                    },
                )
            }
        }

        when {
            state.isLoading && state.profile == null ->
                item {
                    PremiumLoadingCard(
                        message = stringResource(R.string.profile_loading),
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 96.dp)
                                .semantics {
                                    contentDescription = loadingCd
                                },
                    )
                }
            state.profile == null -> {
                if (state.error == null) {
                    item {
                        PremiumStateCard(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .semantics {
                                        contentDescription = notLoadedCd
                                    },
                            title = stringResource(R.string.profile_screen_title),
                            message = stringResource(R.string.profile_empty_hint),
                            icon = Icons.Outlined.Badge,
                            action = {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    ProfileActionIconButton(
                                        icon = Icons.Outlined.Refresh,
                                        contentDescription = retryCd,
                                        tint = Color(0xFFEAB308),
                                        enabled = !state.isLoading,
                                        isBusy = state.isLoading,
                                        onClick = onRefresh,
                                    )
                                    ProfileActionIconButton(
                                        icon = Icons.Outlined.OpenInBrowser,
                                        contentDescription = accessGateCd,
                                        tint = Color(0xFF16A34A),
                                        enabled = true,
                                        isBusy = false,
                                        onClick = onOpenAccessGate,
                                    )
                                }
                            },
                        )
                    }
                }
            }
            else -> {
                val profile = requireNotNull(state.profile)
                item {
                    ProfileHeroIdentityCard(
                        profile = profile,
                        isLoading = state.isLoading,
                        isAvatarUploading = state.isAvatarUploading,
                        onAvatarClick = { avatarPicker.launch("image/*") },
                        onRefresh = onRefresh,
                        onOpenAccessGate = onOpenAccessGate,
                        onLogout = onLogout,
                    )
                }
            }
        }

        if (state.profile != null) {
            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = stringResource(R.string.profile_settings_section_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!chrome.shouldStackChromeActions) {
                        Text(
                            text = stringResource(R.string.profile_settings_section_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        item {
            ProfileAdaptiveCategorySlots(
                twoColumn = twoColumnCategories,
                slots =
                    listOf(
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.UPDATES,
                                title = stringResource(R.string.profile_category_updates_title),
                                subtitle = stringResource(R.string.profile_category_updates_subtitle),
                                icon = Icons.Outlined.SystemUpdate,
                                defaultExpanded = updatesDefaultExpanded,
                                requestExpand = expandCategoryId == ProfileCategoryId.UPDATES,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.UPDATES),
                                onExpandedToggle = onCategoryToggle,
                                badge = updatesBadge,
                            ) {
                                ProfileOtaUpdateSection(
                                    update = appUpdate,
                                    onCheckForUpdates = onCheckForUpdates,
                                    onOneClickUpdate = onOneClickUpdate,
                                    onCancelDownload = onCancelDownload,
                                    onInstallAborted = onOtaInstallAborted,
                                    onRequestInstall = { file ->
                                        if (!MobileApkInstaller.canInstallPackages(context)) {
                                            installPermissionLauncher.launch(
                                                MobileApkInstaller.openInstallPermissionSettings(context),
                                            )
                                            true
                                        } else {
                                            MobileApkInstaller.launchInstall(context, file)
                                        }
                                    },
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.ACCOUNT,
                                title = stringResource(R.string.profile_category_account_title),
                                subtitle = stringResource(R.string.profile_category_account_subtitle),
                                icon = Icons.Outlined.PrivacyTip,
                                requestExpand = expandCategoryId == ProfileCategoryId.ACCOUNT,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.ACCOUNT),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                ProfilePrivacySection(
                                    privacy = state.privacy,
                                    circles = state.privacyCircles,
                                    isSaving = state.isPrivacySaving,
                                    error = state.privacyError,
                                    onSave = onSavePrivacy,
                                )
                                ProfileEmbeddedDivider()
                                ProfilePrivacyFriendsShortcut(onOpenFriendsPrivacyPreview = onOpenFriendsPrivacyPreview)
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.SECURITY,
                                title = stringResource(R.string.profile_category_security_title),
                                subtitle = stringResource(R.string.profile_category_security_subtitle),
                                icon = Icons.Outlined.Shield,
                                requestExpand = expandCategoryId == ProfileCategoryId.SECURITY,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.SECURITY),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                SecureConnectionHowItWorksSection()
                                ProfileEmbeddedDivider()
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        text = stringResource(R.string.profile_biometric_unlock_title),
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        text = stringResource(R.string.profile_biometric_unlock_body),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    if (!biometricUnlockAvailable) {
                                        Text(
                                            text = stringResource(R.string.profile_biometric_unlock_unavailable),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.error,
                                        )
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text(
                                            text = stringResource(R.string.profile_biometric_unlock_title),
                                            style = MaterialTheme.typography.bodyMedium,
                                            modifier = Modifier.weight(1f),
                                        )
                                        Switch(
                                            checked = biometricUnlockEnabled,
                                            onCheckedChange = onBiometricUnlockEnabledChange,
                                            enabled = biometricUnlockAvailable || biometricUnlockEnabled,
                                        )
                                    }
                                }
                                ProfileEmbeddedDivider()
                                if (!state.trustedDeviceBinding.serverBound) {
                                    PerimeterAccessCard(
                                        state = state.perimeterAccess,
                                        appSessionActive = appSessionActive,
                                        onRenewAccess = onRenewPerimeterAccess,
                                        onAutoRenewChange = onPerimeterAutoRenewChange,
                                        onCheckAccess = onCheckPerimeterAccess,
                                    )
                                    ProfileEmbeddedDivider()
                                }
                                TrustedDeviceBindingCard(
                                    state = state.trustedDeviceBinding,
                                    secureConnectionActive =
                                        state.privateTunnel.connectionMode ==
                                            PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA,
                                    sessionActive = appSessionActive,
                                    onPayloadChange = onTrustedDevicePairingPayloadChange,
                                    onPrepareGafE2eeChange = onTrustedDevicePrepareGafE2eeChange,
                                    onBind = onBindTrustedDevice,
                                    onRevoke = onRevokeTrustedDevice,
                                    onClearLocal = onClearLocalTrustedDeviceBinding,
                                    onConfirmSecureConnection = onConfirmSecureConnectionAfterBind,
                                    onDismissSecureConnection = onDismissSecureConnectionConsent,
                                )
                                ProfileEmbeddedDivider()
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        text = stringResource(R.string.profile_logout_policy_title),
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        text = stringResource(R.string.profile_logout_policy_body),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                ScaledOutlinedButton(
                                    onClick = onLogout,
                                    label = stringResource(R.string.profile_security_logout_action),
                                    icon = Icons.AutoMirrored.Outlined.Logout,
                                    enabled = true,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.VIDEO_CALLS,
                                title = stringResource(R.string.profile_category_video_calls_title),
                                subtitle = stringResource(R.string.profile_category_video_calls_subtitle),
                                icon = Icons.Outlined.Videocam,
                                requestExpand = expandCategoryId == ProfileCategoryId.VIDEO_CALLS,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.VIDEO_CALLS),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                ProfileVideoCallsSection(
                                    callTarget = callTarget,
                                    saving = callTargetSaving,
                                    error = callTargetError,
                                    onCallTargetChange = onCallTargetChange,
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.NOTIFICATIONS,
                                title = stringResource(R.string.profile_category_notifications_title),
                                subtitle = stringResource(R.string.profile_category_notifications_subtitle),
                                icon = Icons.Outlined.Notifications,
                                requestExpand = expandCategoryId == ProfileCategoryId.NOTIFICATIONS,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.NOTIFICATIONS),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                ProfileNotificationCenterShortcut(
                                    onOpenNotificationCenter = onOpenNotificationCenter,
                                )
                                ProfileEmbeddedDivider()
                                ProfileNotificationPreferencesSection(
                                    pushEnabled = notificationsEnabled,
                                    onPushEnabledChange = onNotificationsEnabledChange,
                                    pushDiagnostics = pushDiagnostics,
                                    onOpenNotificationSettings = onOpenNotificationSettings,
                                    onRequestNotificationPermission = onRequestNotificationPermission,
                                    onPreferencesChanged = onNotificationPreferencesChanged,
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.APPEARANCE,
                                title = stringResource(R.string.profile_category_appearance_title),
                                subtitle = stringResource(R.string.profile_category_appearance_subtitle),
                                icon = Icons.Outlined.Palette,
                                requestExpand = expandCategoryId == ProfileCategoryId.APPEARANCE,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.APPEARANCE),
                                onExpandedToggle = onCategoryToggle,
                                badge = stringResource(mobileUiStyleLabelRes(mobileUiStyle)),
                            ) {
                                ProfileAppearanceSection(
                                    mobileUiStyle = mobileUiStyle,
                                    onMobileUiStyleChange = onMobileUiStyleChange,
                                    mobileColorMode = mobileColorMode,
                                    onMobileColorModeChange = onMobileColorModeChange,
                                    mobileUiScale = mobileUiScale,
                                    onMobileUiScaleChange = onMobileUiScaleChange,
                                    chatVisualStyle = chatVisualStyle,
                                    onChatVisualStyleChange = onChatVisualStyleChange,
                                    chatTypography = chatTypography,
                                    onChatTypographyChange = onChatTypographyChange,
                                    currentBg = currentBg,
                                    onPickGallery = { bgPicker.launch("image/*") },
                                    onResetWallpaper = {
                                        MobileUiStylePreferences.setBackgroundImage(context, null)
                                        currentBg = null
                                        onBackgroundImageChanged()
                                    },
                                    onSelectPreset = { uriString ->
                                        MobileUiStylePreferences.setBackgroundImage(context, uriString)
                                        currentBg = uriString
                                        onBackgroundImageChanged()
                                    },
                                    reduceMotion = reduceMotion,
                                    highContrastHint = highContrastHint,
                                    onReduceMotionChange = onReduceMotionChange,
                                    onHighContrastChange = onHighContrastChange,
                                    introSplashEnabled = introSplashEnabled,
                                    onIntroSplashEnabledChange = onIntroSplashEnabledChange,
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.STORAGE,
                                title = stringResource(R.string.profile_category_storage_title),
                                subtitle = stringResource(R.string.profile_category_storage_subtitle),
                                icon = Icons.Outlined.Storage,
                                requestExpand = expandCategoryId == ProfileCategoryId.STORAGE,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.STORAGE),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                ProfileLocalStorageCard(
                                    state = state.storage,
                                    onClearMediaCache = onClearMediaCache,
                                    onClearOfflineData = onClearOfflineCache,
                                )
                                ProfileEmbeddedDivider()
                                ProfileAudioStreamCacheCard(
                                    state = state.storage,
                                    onWifiOnlyPrefetchChange = onStreamCacheWifiOnlyChange,
                                    onClearStreamCache = onClearStreamCache,
                                )
                            }
                        },
                        {
                            ProfileCollapsibleCategory(
                                id = ProfileCategoryId.SUPPORT,
                                title = stringResource(R.string.profile_category_support_title),
                                subtitle = stringResource(R.string.profile_category_support_subtitle),
                                icon = Icons.Outlined.SupportAgent,
                                requestExpand = expandCategoryId == ProfileCategoryId.SUPPORT,
                                onExpandConsumed = onExpandCategoryConsumed,
                                expandedOverride = categoryExpanded(ProfileCategoryId.SUPPORT),
                                onExpandedToggle = onCategoryToggle,
                            ) {
                                ProfileFeedbackHubShortcut(onOpenFeedbackHub = onOpenFeedbackHub)
                                ProfileEmbeddedDivider()
                                ProfileDeviceSessionCard(state = state.deviceSession)
                                if (state.supportMode) {
                                    ProfileEmbeddedDivider()
                                    ProfileRuntimeDiagnosticsSection(
                                        state = runtimeDiagnostics,
                                        onExpandedChange = onRuntimeDiagnosticsExpandedChange,
                                        onAnalyticsEnabledChange = onAnalyticsEnabledChange,
                                        onFontStressChange = onFontStressChange,
                                    )
                                    ProfileEmbeddedDivider()
                                    ProfileSupportBundleCard(
                                        bundleText = state.supportBundleText,
                                        onExport = onExportSupportBundle,
                                        onSubmit = onSubmitSupportReport,
                                        isSubmitting = state.supportReportSubmitting,
                                        feedback = state.supportReportFeedback,
                                    )
                                }
                            }
                        },
                    ),
            )
        }
    }
}

