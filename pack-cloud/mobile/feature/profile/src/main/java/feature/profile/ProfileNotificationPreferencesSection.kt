/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile notifications settings — one master toggle, one switch per category, compact quiet hours.
 *
 * Invariants:
 * - Per-category mute flags remain in storage but UI exposes only on/off delivery per category.
 * - Technical push diagnostics surface only when delivery may be blocked.
 *
 * Related:
 * - MobileNotificationPreferences, ProfileFeature.kt, MainActivity permission flow
 */
package feature.profile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.DoNotDisturb
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import feature.notifications.MobileNotificationPreferences
import feature.notifications.NotificationPreferenceCategory
import feature.notifications.NotificationPreferencesSnapshot
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.PremiumSectionCard

data class PushDiagnosticsUiState(
    val pushEnabled: Boolean = true,
    val postNotificationsGranted: Boolean = true,
    val fcmToken: String? = null,
    val socketLifecycle: SocketLifecycleState = SocketLifecycleState.Disconnected,
    val batteryOptimizationExempt: Boolean = true,
)

@Composable
fun ProfileNotificationPreferencesSection(
    pushEnabled: Boolean,
    onPushEnabledChange: (Boolean) -> Unit,
    pushDiagnostics: PushDiagnosticsUiState,
    onOpenNotificationSettings: () -> Unit,
    onRequestNotificationPermission: () -> Unit = {},
    modifier: Modifier = Modifier,
    onPreferencesChanged: () -> Unit = {},
) {
    val context = LocalContext.current
    var prefs by remember { mutableStateOf(MobileNotificationPreferences.read(context)) }

    fun persist(next: NotificationPreferencesSnapshot) {
        MobileNotificationPreferences.write(context, next)
        prefs = next
        onPreferencesChanged()
    }

    PremiumSectionCard(
        modifier = modifier.fillMaxWidth(),
        title = stringResource(R.string.profile_notif_section_title),
        subtitle = stringResource(R.string.profile_notif_section_subtitle),
        icon = Icons.Outlined.NotificationsActive,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            NotificationMasterToggleRow(
                label = stringResource(R.string.profile_notifications_push),
                hint = stringResource(R.string.profile_notif_master_hint),
                checked = pushEnabled,
                onCheckedChange = onPushEnabledChange,
            )

            if (pushEnabled) {
                Text(
                    text = stringResource(R.string.profile_notif_categories_heading),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                NotificationCategoryRow(
                    icon = Icons.Outlined.Chat,
                    label = stringResource(R.string.profile_notif_cat_chat),
                    hint = stringResource(R.string.profile_notif_cat_chat_hint),
                    checked = prefs.isCategoryEnabled(NotificationPreferenceCategory.CHAT),
                    onCheckedChange = { enabled ->
                        val next = prefs.withCategoryDelivering(NotificationPreferenceCategory.CHAT, enabled)
                        persist(next)
                        MobileNotificationPreferences.setCategoryEnabled(context, NotificationPreferenceCategory.CHAT, enabled)
                        if (!enabled) {
                            MobileNotificationPreferences.setCategoryMuted(context, NotificationPreferenceCategory.CHAT, false)
                        }
                    },
                )
                NotificationCategoryRow(
                    icon = Icons.Outlined.Group,
                    label = stringResource(R.string.profile_notif_cat_friends),
                    hint = stringResource(R.string.profile_notif_cat_friends_hint),
                    checked = prefs.isCategoryEnabled(NotificationPreferenceCategory.FRIENDS),
                    onCheckedChange = { enabled ->
                        val next = prefs.withCategoryDelivering(NotificationPreferenceCategory.FRIENDS, enabled)
                        persist(next)
                        MobileNotificationPreferences.setCategoryEnabled(context, NotificationPreferenceCategory.FRIENDS, enabled)
                        if (!enabled) {
                            MobileNotificationPreferences.setCategoryMuted(context, NotificationPreferenceCategory.FRIENDS, false)
                        }
                    },
                )
                NotificationCategoryRow(
                    icon = Icons.Outlined.MusicNote,
                    label = stringResource(R.string.profile_notif_cat_ugs),
                    hint = stringResource(R.string.profile_notif_cat_ugs_hint),
                    checked = prefs.isCategoryEnabled(NotificationPreferenceCategory.UGS),
                    onCheckedChange = { enabled ->
                        val next = prefs.withCategoryDelivering(NotificationPreferenceCategory.UGS, enabled)
                        persist(next)
                        MobileNotificationPreferences.setCategoryEnabled(context, NotificationPreferenceCategory.UGS, enabled)
                        if (!enabled) {
                            MobileNotificationPreferences.setCategoryMuted(context, NotificationPreferenceCategory.UGS, false)
                        }
                    },
                )
                NotificationCategoryRow(
                    icon = Icons.Outlined.Settings,
                    label = stringResource(R.string.profile_notif_cat_system),
                    hint = stringResource(R.string.profile_notif_cat_system_hint),
                    checked = prefs.isCategoryEnabled(NotificationPreferenceCategory.SYSTEM),
                    onCheckedChange = { enabled ->
                        val next = prefs.withCategoryDelivering(NotificationPreferenceCategory.SYSTEM, enabled)
                        persist(next)
                        MobileNotificationPreferences.setCategoryEnabled(context, NotificationPreferenceCategory.SYSTEM, enabled)
                        if (!enabled) {
                            MobileNotificationPreferences.setCategoryMuted(context, NotificationPreferenceCategory.SYSTEM, false)
                        }
                    },
                )

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.55f),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        NotificationMasterToggleRow(
                            label = stringResource(R.string.profile_notif_quiet_title),
                            hint = stringResource(R.string.profile_notif_quiet_hint),
                            checked = prefs.quietHoursEnabled,
                            onCheckedChange = {
                                val next = prefs.copy(quietHoursEnabled = it)
                                persist(next)
                                MobileNotificationPreferences.setQuietHours(
                                    context,
                                    it,
                                    next.quietHoursStartMinute,
                                    next.quietHoursEndMinute,
                                )
                            },
                        )
                        if (prefs.quietHoursEnabled) {
                            Text(
                                stringResource(
                                    R.string.profile_notif_quiet_window,
                                    MobileNotificationPreferences.formatMinuteOfDay(prefs.quietHoursStartMinute),
                                    MobileNotificationPreferences.formatMinuteOfDay(prefs.quietHoursEndMinute),
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(
                                    selected =
                                        prefs.quietHoursStartMinute == 22 * 60 &&
                                            prefs.quietHoursEndMinute == 8 * 60,
                                    onClick = {
                                        val next = prefs.copy(quietHoursStartMinute = 22 * 60, quietHoursEndMinute = 8 * 60)
                                        persist(next)
                                        MobileNotificationPreferences.setQuietHours(
                                            context,
                                            next.quietHoursEnabled,
                                            next.quietHoursStartMinute,
                                            next.quietHoursEndMinute,
                                        )
                                    },
                                    label = { Text(stringResource(R.string.profile_notif_quiet_preset_night)) },
                                )
                                FilterChip(
                                    selected =
                                        prefs.quietHoursStartMinute == 13 * 60 &&
                                            prefs.quietHoursEndMinute == 14 * 60,
                                    onClick = {
                                        val next = prefs.copy(quietHoursStartMinute = 13 * 60, quietHoursEndMinute = 14 * 60)
                                        persist(next)
                                        MobileNotificationPreferences.setQuietHours(
                                            context,
                                            next.quietHoursEnabled,
                                            next.quietHoursStartMinute,
                                            next.quietHoursEndMinute,
                                        )
                                    },
                                    label = { Text(stringResource(R.string.profile_notif_quiet_preset_lunch)) },
                                )
                            }
                        }
                    }
                }
            }

            ProfilePushDeliveryBanner(
                state = pushDiagnostics,
                onOpenNotificationSettings = onOpenNotificationSettings,
                onRequestNotificationPermission = onRequestNotificationPermission,
            )
            ProfileBatteryOptimizationBanner(
                exempt = pushDiagnostics.batteryOptimizationExempt,
                pushEnabled = pushEnabled,
            )
        }
    }
}

@Composable
private fun NotificationMasterToggleRow(
    label: String,
    hint: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun NotificationCategoryRow(
    icon: ImageVector,
    label: String,
    hint: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        androidx.compose.material3.Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.85f),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(hint, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
fun ProfileBatteryOptimizationBanner(
    exempt: Boolean,
    pushEnabled: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!pushEnabled || exempt) return
    val context = LocalContext.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.45f),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.profile_push_battery_title),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
            Text(
                stringResource(R.string.profile_push_battery_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
            TextButton(onClick = { MobileBatteryOptimizationSupport.openRequestExemption(context) }) {
                Text(stringResource(R.string.profile_push_battery_action))
            }
        }
    }
}

@Composable
fun ProfilePushDeliveryBanner(
    state: PushDiagnosticsUiState,
    onOpenNotificationSettings: () -> Unit,
    onRequestNotificationPermission: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val needsPermissionFix =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !state.postNotificationsGranted
    if (!needsPermissionFix) return

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.55f),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.material3.Icon(
                    Icons.Outlined.DoNotDisturb,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                )
                Text(
                    stringResource(R.string.profile_push_delivery_blocked_title),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
            Text(
                stringResource(R.string.profile_push_delivery_blocked_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onRequestNotificationPermission) {
                    Text(stringResource(R.string.profile_push_delivery_request_permission))
                }
                TextButton(onClick = onOpenNotificationSettings) {
                    Text(stringResource(R.string.profile_push_diag_open_settings))
                }
            }
        }
    }
}

/** @deprecated Use [ProfilePushDeliveryBanner] — kept for call-site compatibility during refactor. */
@Composable
fun ProfilePushDiagnosticsSection(
    state: PushDiagnosticsUiState,
    onOpenNotificationSettings: () -> Unit,
    onRequestNotificationPermission: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    ProfilePushDeliveryBanner(
        state = state,
        onOpenNotificationSettings = onOpenNotificationSettings,
        onRequestNotificationPermission = onRequestNotificationPermission,
        modifier = modifier,
    )
}

fun openAppNotificationSettings(context: android.content.Context) {
    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }.onFailure {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
