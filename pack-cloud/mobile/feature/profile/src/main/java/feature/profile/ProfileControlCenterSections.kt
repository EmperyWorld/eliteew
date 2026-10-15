/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap profile-001…010 UI sections: account/device cards, storage, appearance preview,
 * accessibility, support bundle export, avatar preview dialog.
 *
 * Invariants:
 * - User id hidden unless support mode enabled; support bundle never includes secrets.
 *
 * Related:
 * - ProfileFeature.kt, ProfileRoadmapSupport.kt, ProfileTabViewModel
 */
package feature.profile

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.LocalMobileSurfaceStyle
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton

data class ProfileDeviceSessionUiState(
    val appVersionName: String = "",
    val appVersionCode: Int = 0,
    val buildFlavor: String = "",
    val apiHost: String = "",
    val socketState: SocketLifecycleState = SocketLifecycleState.Disconnected,
    val fcmRegistered: Boolean = false,
)

data class ProfileStorageUiState(
    val stats: ProfileLocalStorageStats = ProfileLocalStorageStats(),
    val isClearing: Boolean = false,
    val wifiOnlyStreamPrefetch: Boolean = false,
)

@Composable
fun ProfileControlCenterHeader(modifier: Modifier = Modifier) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_control_center_title),
        subtitle = stringResource(R.string.profile_control_center_subtitle),
        icon = Icons.Outlined.Devices,
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(
            text = stringResource(R.string.profile_control_center_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun ProfileAccountDataCard(
    userId: String?,
    email: String?,
    username: String?,
    supportMode: Boolean,
    onSupportModeChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    var revealId by remember { mutableStateOf(false) }
    val context = LocalContext.current
    PremiumSectionCard(
        title = stringResource(R.string.profile_account_data_title),
        subtitle = stringResource(R.string.profile_account_data_subtitle),
        icon = Icons.Outlined.Fingerprint,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileInfoRow(stringResource(R.string.profile_account_email), email)
            ProfileInfoRow(stringResource(R.string.profile_account_username), username)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(R.string.profile_account_support_mode), style = MaterialTheme.typography.bodyMedium)
                Switch(checked = supportMode, onCheckedChange = onSupportModeChange)
            }
            if (supportMode && !userId.isNullOrBlank()) {
                ProfileInfoRow(
                    stringResource(R.string.profile_account_user_id),
                    if (revealId) userId else stringResource(R.string.profile_account_user_id_hidden),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ScaledOutlinedButton(
                        onClick = { revealId = !revealId },
                        enabled = true,
                        label = stringResource(if (revealId) R.string.profile_account_hide_id else R.string.profile_account_reveal_id),
                        icon = if (revealId) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                        modifier = Modifier.weight(1f),
                    )
                    ScaledOutlinedButton(
                        enabled = true,
                        onClick = {
                            copyToClipboard(context, userId)
                            Toast.makeText(context, R.string.profile_account_copied, Toast.LENGTH_SHORT).show()
                        },
                        label = stringResource(R.string.profile_account_copy_id),
                        icon = Icons.Outlined.ContentCopy,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
fun ProfileDeviceSessionCard(
    state: ProfileDeviceSessionUiState,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_device_session_title),
        subtitle = stringResource(R.string.profile_device_session_subtitle),
        icon = Icons.Outlined.Devices,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            ProfileInfoRow(stringResource(R.string.profile_device_app_version), "${state.appVersionName} (${state.appVersionCode})")
            ProfileInfoRow(stringResource(R.string.profile_device_build_flavor), state.buildFlavor)
            ProfileInfoRow(stringResource(R.string.profile_device_api_host), state.apiHost)
            ProfileInfoRow(stringResource(R.string.profile_device_socket), state.socketState.name.lowercase())
            ProfileInfoRow(
                stringResource(R.string.profile_device_fcm),
                stringResource(if (state.fcmRegistered) R.string.profile_push_diag_yes else R.string.profile_push_diag_no),
            )
        }
    }
}

@Composable
fun ProfileLocalStorageCard(
    state: ProfileStorageUiState,
    onClearMediaCache: () -> Unit,
    onClearOfflineData: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val stats = state.stats
    PremiumSectionCard(
        title = stringResource(R.string.profile_storage_title),
        subtitle = stringResource(R.string.profile_storage_subtitle),
        icon = Icons.Outlined.Storage,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileInfoRow(stringResource(R.string.profile_storage_total), formatStorageBytes(stats.totalBytes))
            ProfileInfoRow(stringResource(R.string.profile_storage_media), formatStorageBytes(stats.coilCacheBytes + stats.chatAttachmentBytes))
            ProfileInfoRow(
                stringResource(R.string.profile_storage_stream_cache),
                stringResource(
                    R.string.profile_storage_stream_cache_value,
                    formatStorageBytes(stats.streamCacheBytes),
                    stats.streamCacheTrackCount,
                ),
            )
            ProfileInfoRow(stringResource(R.string.profile_storage_offline), formatStorageBytes(stats.offlineFeedBytesEstimate))
            ProfileInfoRow(stringResource(R.string.profile_storage_apk), formatStorageBytes(stats.apkUpdatesBytes))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ScaledOutlinedButton(
                    onClick = onClearMediaCache,
                    enabled = !state.isClearing,
                    label = stringResource(R.string.profile_storage_clear_media),
                    icon = Icons.Outlined.Delete,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = onClearOfflineData,
                    enabled = !state.isClearing,
                    label = stringResource(R.string.profile_storage_clear_offline),
                    icon = Icons.Outlined.Delete,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
fun ProfileAudioStreamCacheCard(
    state: ProfileStorageUiState,
    onWifiOnlyPrefetchChange: (Boolean) -> Unit,
    onClearStreamCache: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_stream_cache_title),
        subtitle = stringResource(R.string.profile_stream_cache_subtitle),
        icon = Icons.Outlined.Wifi,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.profile_stream_cache_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ProfileInfoRow(
                stringResource(R.string.profile_stream_cache_used),
                stringResource(
                    R.string.profile_storage_stream_cache_value,
                    formatStorageBytes(state.stats.streamCacheBytes),
                    state.stats.streamCacheTrackCount,
                ),
            )
            ProfileInfoRow(
                stringResource(R.string.profile_stream_cache_limit),
                stringResource(R.string.profile_stream_cache_limit_value),
            )
            PremiumRowSurface(
                modifier = Modifier.fillMaxWidth(),
                containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
            ) {
                Text(
                    text = stringResource(R.string.profile_stream_cache_wifi_only),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = state.wifiOnlyStreamPrefetch,
                    onCheckedChange = onWifiOnlyPrefetchChange,
                    enabled = !state.isClearing,
                )
            }
            ScaledOutlinedButton(
                onClick = onClearStreamCache,
                enabled = !state.isClearing && state.stats.streamCacheBytes > 0L,
                label = stringResource(R.string.profile_stream_cache_clear),
                icon = Icons.Outlined.Delete,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun ProfileColorModeSection(
    selected: MobileColorMode,
    onSelect: (MobileColorMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_color_mode_section),
        subtitle = stringResource(R.string.profile_color_mode_hint),
        icon = Icons.Outlined.Devices,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MobileColorMode.entries.forEach { mode ->
                val isSelected = selected == mode
                PremiumRowSurface(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(mode) },
                    containerColor =
                        if (isSelected) {
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f)
                        } else {
                            null
                        },
                    borderColor =
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
                        } else {
                            null
                        },
                    tonalElevation = if (isSelected) 3.dp else null,
                ) {
                    Text(
                        text = stringResource(mobileColorModeLabelRes(mode)),
                        modifier = Modifier.weight(1f),
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                    )
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Outlined.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun themePreviewAccent(style: MobileUiStyle): Color =
    when (style) {
        MobileUiStyle.SYSTEM -> MaterialTheme.colorScheme.primary
        MobileUiStyle.GLASS -> Color(0xFF0284C7)
        MobileUiStyle.PREMIUM -> Color(0xFF9A6B2E)
        MobileUiStyle.EMERALD -> Color(0xFF059669)
        MobileUiStyle.MIDNIGHT -> Color(0xFF4338CA)
        MobileUiStyle.OBSIDIAN -> Color(0xFFE8E8E8)
    }

@Composable
fun ProfileAppearancePreviewCard(
    mobileUiStyle: MobileUiStyle,
    onMobileUiStyleChange: (MobileUiStyle) -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_theme_section),
        subtitle = stringResource(R.string.profile_theme_preview_hint),
        icon = Icons.Outlined.Info,
        modifier = modifier.fillMaxWidth(),
    ) {
        val themePreviewRows = (MobileUiStyle.entries.size + 1) / 2
        val themeGridHeight =
            (themePreviewRows * 172f * LocalDensity.current.fontScale.coerceIn(1f, 1.2f)).dp
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.height(maxOf(280.dp, themeGridHeight)),
        ) {
            items(MobileUiStyle.entries, key = { it.name }) { style ->
                val selected = mobileUiStyle == style
                val accent = themePreviewAccent(style)
                val surfaceStyle = LocalMobileSurfaceStyle.current
                val containerAlpha =
                    when (surfaceStyle) {
                        MobileSurfaceStyle.GLASS -> 0.58f
                        MobileSurfaceStyle.PREMIUM -> 0.94f
                        MobileSurfaceStyle.SYSTEM -> 0.82f
                    }
                val defaultBorder =
                    when (surfaceStyle) {
                        MobileSurfaceStyle.GLASS -> Color.White.copy(alpha = 0.42f)
                        MobileSurfaceStyle.PREMIUM -> MaterialTheme.colorScheme.primary.copy(alpha = 0.38f)
                        MobileSurfaceStyle.SYSTEM -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)
                    }
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color =
                        if (selected) {
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = containerAlpha)
                        } else {
                            MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = containerAlpha)
                        },
                    border =
                        BorderStroke(
                            1.dp,
                            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.55f) else defaultBorder,
                        ),
                    modifier = Modifier.fillMaxWidth().clickable { onMobileUiStyleChange(style) },
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = accent.copy(alpha = 0.22f),
                                border = BorderStroke(1.dp, accent.copy(alpha = 0.55f)),
                                modifier = Modifier.size(28.dp),
                            ) {
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(6.dp)
                                            .background(accent, RoundedCornerShape(4.dp)),
                                )
                            }
                            Text(
                                text = stringResource(mobileUiStyleLabelRes(style)),
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.titleSmall,
                            )
                        }
                        Text(
                            text = stringResource(mobileUiStyleDescriptionRes(style)),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 3,
                        )
                    }
                }
            }
        }
        Text(
            text = stringResource(R.string.profile_theme_contrast_note),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
fun ProfileAccessibilityCard(
    reduceMotion: Boolean,
    highContrastHint: Boolean,
    onReduceMotionChange: (Boolean) -> Unit,
    onHighContrastChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_a11y_title),
        subtitle = stringResource(R.string.profile_a11y_subtitle),
        icon = Icons.Outlined.Visibility,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.profile_a11y_font_scale_hint), style = MaterialTheme.typography.bodySmall)
            PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.profile_a11y_reduce_motion),
                    modifier = Modifier.weight(1f),
                )
                Switch(checked = reduceMotion, onCheckedChange = onReduceMotionChange)
            }
            PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.profile_a11y_high_contrast),
                    modifier = Modifier.weight(1f),
                )
                Switch(checked = highContrastHint, onCheckedChange = onHighContrastChange)
            }
        }
    }
}

@Composable
fun ProfileSupportBundleCard(
    bundleText: String,
    onExport: () -> Unit,
    onSubmit: () -> Unit,
    isSubmitting: Boolean = false,
    feedback: String? = null,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val canSubmit = bundleText.isNotBlank() && !isSubmitting
    PremiumSectionCard(
        title = stringResource(R.string.profile_support_bundle_title),
        subtitle = stringResource(R.string.profile_support_bundle_subtitle),
        icon = Icons.Outlined.Share,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(bundleText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ScaledButton(
                    onClick = onExport,
                    enabled = bundleText.isNotBlank(),
                    label = stringResource(R.string.profile_support_bundle_export),
                    icon = Icons.Outlined.Share,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    enabled = bundleText.isNotBlank(),
                    onClick = {
                        copyToClipboard(context, bundleText)
                        Toast.makeText(context, R.string.profile_account_copied, Toast.LENGTH_SHORT).show()
                    },
                    label = stringResource(R.string.profile_support_bundle_copy),
                    icon = Icons.Outlined.ContentCopy,
                    modifier = Modifier.weight(1f),
                )
            }
            ScaledButton(
                onClick = onSubmit,
                enabled = canSubmit,
                label = stringResource(R.string.profile_support_bundle_submit),
                icon = Icons.Outlined.CloudUpload,
                modifier = Modifier.fillMaxWidth(),
                loading = isSubmitting,
            )
            feedback?.takeIf { it.isNotBlank() }?.let { message ->
                Text(
                    message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
fun ProfileFeedbackHubShortcut(
    onOpenFeedbackHub: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(R.string.profile_feedback_hub_shortcut_title),
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                stringResource(R.string.profile_feedback_hub_shortcut_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        ScaledOutlinedButton(
            onClick = onOpenFeedbackHub,
            enabled = true,
            label = stringResource(R.string.profile_feedback_hub_shortcut_open),
            icon = Icons.Outlined.ChatBubbleOutline,
        )
    }
}

@Composable
fun ProfileNotificationCenterShortcut(
    onOpenNotificationCenter: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(R.string.profile_notification_center_shortcut_title),
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                stringResource(R.string.profile_notification_center_shortcut_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        ScaledOutlinedButton(
            onClick = onOpenNotificationCenter,
            enabled = true,
            label = stringResource(R.string.profile_notification_center_shortcut_open),
            icon = Icons.Outlined.Notifications,
        )
    }
}

@Composable
fun ProfilePrivacyFriendsShortcut(
    onOpenFriendsPrivacyPreview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(stringResource(R.string.profile_privacy_friends_shortcut_title), fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.profile_privacy_friends_shortcut_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        ScaledOutlinedButton(
            onClick = onOpenFriendsPrivacyPreview,
            enabled = true,
            label = stringResource(R.string.profile_privacy_friends_shortcut_action),
            icon = Icons.Outlined.OpenInBrowser,
        )
    }
}

@Composable
fun ProfileAvatarPreviewDialog(
    previewUri: Uri?,
    compressInfo: String?,
    isUploading: Boolean,
    onConfirm: () -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (previewUri == null) return
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.profile_avatar_preview_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                compressInfo?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall)
                }
                Text(stringResource(R.string.profile_avatar_preview_hint))
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isUploading) {
                Text(stringResource(R.string.profile_avatar_preview_upload))
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onRemove) { Text(stringResource(R.string.profile_avatar_preview_remove)) }
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.profile_avatar_preview_cancel)) }
            }
        },
    )
}

@Composable
private fun ProfileInfoRow(label: String, value: String?) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value?.ifBlank { "—" } ?: "—", style = MaterialTheme.typography.bodyMedium)
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText("eliteew", text))
}
