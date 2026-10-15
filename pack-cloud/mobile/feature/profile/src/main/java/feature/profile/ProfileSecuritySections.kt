/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile Security composables: trusted-device bind card and private tunnel card.
 *
 * Invariants:
 * - Same package as ProfileFeature; call sites stay stable without import churn.
 *
 * Related:
 * - ProfileFeature.kt, ProfileTabViewModel, ProfileScreen
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
internal fun ProfileSectionCard(
    title: String,
    subtitle: String?,
    icon: ImageVector,
    content: @Composable () -> Unit,
) {
    PremiumSectionCard(
        title = title,
        subtitle = subtitle,
        icon = icon,
        modifier = Modifier.fillMaxWidth(),
    ) {
        content()
    }
}

@Composable
internal fun SecureConnectionHowItWorksSection() {
    var showDialog by remember { mutableStateOf(false) }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            icon = {
                Icon(
                    Icons.Outlined.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            },
            title = {
                Text(stringResource(R.string.profile_secure_connection_how_title))
            },
            text = {
                Text(stringResource(R.string.profile_secure_connection_how_body))
            },
            confirmButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text(stringResource(R.string.profile_secure_connection_how_close))
                }
            },
        )
    }

    OutlinedButton(
        onClick = { showDialog = true },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Icon(
            Icons.Outlined.Info,
            contentDescription = null,
            modifier = Modifier.size(18.dp),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(stringResource(R.string.profile_secure_connection_how_action))
    }
}

@Composable
internal fun TrustedDeviceBindingCard(
    state: TrustedDeviceBindingUiState,
    secureConnectionActive: Boolean,
    sessionActive: Boolean,
    onPayloadChange: (String) -> Unit,
    onPrepareGafE2eeChange: (Boolean) -> Unit,
    onBind: () -> Unit,
    onRevoke: () -> Unit,
    onClearLocal: () -> Unit,
    onConfirmSecureConnection: () -> Unit,
    onDismissSecureConnection: () -> Unit,
) {
    var showRevokeConfirm by remember { mutableStateOf(false) }
    val pairingDigits = state.pairingPayload.filter { it.isDigit() }

    LaunchedEffect(pairingDigits, state.serverBound, state.isBinding, state.isRevoking, sessionActive) {
        if (
            sessionActive &&
            !state.serverBound &&
            !state.isBinding &&
            !state.isRevoking &&
            pairingDigits.length == 8
        ) {
            onBind()
        }
    }

    if (state.pendingSecureConnectionConsent) {
        AlertDialog(
            onDismissRequest = onDismissSecureConnection,
            icon = {
                Icon(
                    Icons.Outlined.VpnKey,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            },
            title = {
                Text(stringResource(R.string.profile_trusted_device_secure_consent_title))
            },
            text = {
                Text(stringResource(R.string.profile_trusted_device_secure_consent_body))
            },
            confirmButton = {
                TextButton(onClick = onConfirmSecureConnection) {
                    Text(stringResource(R.string.profile_trusted_device_secure_consent_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissSecureConnection) {
                    Text(stringResource(R.string.profile_trusted_device_secure_consent_decline))
                }
            },
        )
    }

    if (showRevokeConfirm) {
        AlertDialog(
            onDismissRequest = { showRevokeConfirm = false },
            icon = {
                Icon(
                    Icons.Outlined.Shield,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                )
            },
            title = {
                Text(stringResource(R.string.profile_trusted_device_revoke_confirm_title))
            },
            text = {
                Text(stringResource(R.string.profile_trusted_device_revoke_confirm_body))
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showRevokeConfirm = false
                        onRevoke()
                    },
                ) {
                    Text(stringResource(R.string.profile_trusted_device_revoke_confirm_yes))
                }
            },
            dismissButton = {
                TextButton(onClick = { showRevokeConfirm = false }) {
                    Text(stringResource(R.string.profile_trusted_device_secure_consent_decline))
                }
            },
        )
    }

    ProfileSectionCard(
        title = stringResource(R.string.profile_trusted_device_title),
        subtitle = stringResource(R.string.profile_trusted_device_subtitle),
        icon = Icons.Outlined.Shield,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (state.isSyncing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = stringResource(R.string.profile_trusted_device_syncing),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (state.serverBound) {
                val boundLabel =
                    state.boundDeviceLabel?.takeIf { it.isNotBlank() }
                        ?: stringResource(R.string.profile_trusted_device_default_label)
                AppUpdateBanner(
                    title =
                        stringResource(
                            R.string.profile_trusted_device_bound_status,
                            boundLabel,
                        ),
                    message =
                        if (state.configReceived) {
                            stringResource(R.string.profile_trusted_device_config_received)
                        } else {
                            null
                        },
                    icon = Icons.Outlined.CheckCircle,
                    isSuccess = true,
                )
                if (state.configReceived) {
                    AppUpdateBanner(
                        title =
                            if (secureConnectionActive) {
                                stringResource(R.string.profile_trusted_device_secure_mode_active)
                            } else {
                                stringResource(R.string.profile_trusted_device_secure_mode_standard)
                            },
                        message = null,
                        icon = Icons.Outlined.VpnKey,
                    )
                }
                OutlinedButton(
                    onClick = { showRevokeConfirm = true },
                    enabled = sessionActive && !state.isRevoking && !state.isBinding,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.isRevoking) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        text =
                            if (state.isRevoking) {
                                stringResource(R.string.profile_trusted_device_revoking)
                            } else {
                                stringResource(R.string.profile_trusted_device_revoke_action)
                            },
                    )
                }
            } else if (state.localTunnelOnly) {
                Text(
                    text = stringResource(R.string.profile_trusted_device_local_only_warning),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
                OutlinedButton(
                    onClick = onClearLocal,
                    enabled = !state.isRevoking && !state.isBinding,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.profile_trusted_device_clear_local_action))
                }
            } else {
                Text(
                    text = stringResource(R.string.profile_trusted_device_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Switch(
                        checked = state.prepareGafE2ee,
                        onCheckedChange = onPrepareGafE2eeChange,
                        enabled = sessionActive && !state.isBinding && !state.isRevoking,
                    )
                    Text(
                        text = stringResource(R.string.profile_trusted_device_prepare_gaf),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                    )
                }
                OutlinedTextField(
                    value = state.pairingPayload,
                    onValueChange = onPayloadChange,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = sessionActive && !state.isBinding && !state.isRevoking,
                    singleLine = true,
                    label = { Text(stringResource(R.string.profile_trusted_device_payload_label)) },
                    supportingText = {
                        Text(stringResource(R.string.profile_trusted_device_payload_hint))
                    },
                )
                if (state.isBinding) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                        )
                        Text(
                            text = stringResource(R.string.profile_trusted_device_binding),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
            state.error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            state.message?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
internal fun ProfilePrivateTunnelCard(
    state: PrivateTunnelUiState,
    onImportConfig: (String) -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onClearConfig: () -> Unit,
    onConnectionModeChange: (PrivateTunnelConnectionModeUi) -> Unit,
) {
    var configDraft by rememberSaveable { mutableStateOf("") }
    val statusLabel =
        stringResource(
            when (state.status) {
                PrivateTunnelUiStatus.NOT_CONFIGURED -> R.string.profile_private_tunnel_status_not_configured
                PrivateTunnelUiStatus.DISCONNECTED -> R.string.profile_private_tunnel_status_disconnected
                PrivateTunnelUiStatus.PERMISSION_REQUIRED -> R.string.profile_private_tunnel_status_permission
                PrivateTunnelUiStatus.VPN_CONFLICT -> R.string.profile_private_tunnel_status_conflict
                PrivateTunnelUiStatus.CONNECTING -> R.string.profile_private_tunnel_status_connecting
                PrivateTunnelUiStatus.WAITING_EDGE -> R.string.profile_private_tunnel_status_waiting_edge
                PrivateTunnelUiStatus.RETRYING -> R.string.profile_private_tunnel_status_retrying
                PrivateTunnelUiStatus.CONNECTED -> R.string.profile_private_tunnel_status_connected
                PrivateTunnelUiStatus.STOPPING -> R.string.profile_private_tunnel_status_stopping
                PrivateTunnelUiStatus.ERROR -> R.string.profile_private_tunnel_status_error
            },
        )

    ProfileSectionCard(
        title = stringResource(R.string.profile_private_tunnel_title),
        subtitle = stringResource(R.string.profile_private_tunnel_subtitle),
        icon = Icons.Outlined.VpnKey,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ScaledButton(
                    onClick = { onConnectionModeChange(PrivateTunnelConnectionModeUi.PUBLIC_STABLE) },
                    label = stringResource(R.string.profile_private_tunnel_mode_public),
                    icon = Icons.Outlined.Shield,
                    enabled = state.connectionMode != PrivateTunnelConnectionModeUi.PUBLIC_STABLE && !state.isBusy,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = { onConnectionModeChange(PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA) },
                    label = stringResource(R.string.profile_private_tunnel_mode_private),
                    icon = Icons.Outlined.VpnKey,
                    enabled = state.connectionMode != PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA && !state.isBusy,
                    modifier = Modifier.weight(1f),
                )
            }
            if (state.restartRequired) {
                Text(
                    text = stringResource(R.string.profile_private_tunnel_restart_required),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }

            AppUpdateBanner(
                title = stringResource(R.string.profile_private_tunnel_android_notice_title),
                message = stringResource(R.string.profile_private_tunnel_android_notice_body),
                icon = Icons.Outlined.Info,
            )

            if (state.blocksEliteEwTraffic) {
                AppUpdateBanner(
                    title = stringResource(R.string.profile_private_tunnel_fail_closed_title),
                    message =
                        if (state.status == PrivateTunnelUiStatus.VPN_CONFLICT) {
                            stringResource(R.string.profile_private_tunnel_conflict_body)
                        } else {
                            stringResource(R.string.profile_private_tunnel_fail_closed_body)
                        },
                    icon = Icons.Outlined.Shield,
                    isError = state.status == PrivateTunnelUiStatus.VPN_CONFLICT,
                )
            }

            PremiumRowSurface {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text =
                            state.error
                                ?: state.message
                                ?: stringResource(R.string.profile_private_tunnel_body),
                        style = MaterialTheme.typography.bodySmall,
                        color =
                            if (state.error != null) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                    )
                }
            }

            if (state.configImported) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    TunnelMetadataRow(
                        label = stringResource(R.string.profile_private_tunnel_peer_address),
                        value = state.peerAddress,
                    )
                    TunnelMetadataRow(
                        label = stringResource(R.string.profile_private_tunnel_endpoint),
                        value = state.endpoint,
                    )
                    TunnelMetadataRow(
                        label = stringResource(R.string.profile_private_tunnel_dns),
                        value = state.dns,
                    )
                }
            }

            OutlinedTextField(
                value = configDraft,
                onValueChange = { configDraft = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.profile_private_tunnel_config_label)) },
                placeholder = { Text(stringResource(R.string.profile_private_tunnel_config_placeholder)) },
                minLines = 3,
                maxLines = 8,
                enabled = !state.isBusy,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ScaledButton(
                    onClick = {
                        onImportConfig(configDraft)
                        configDraft = ""
                    },
                    label = stringResource(R.string.profile_private_tunnel_save),
                    icon = Icons.Filled.Check,
                    enabled = configDraft.isNotBlank() && !state.isBusy,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = onClearConfig,
                    label = stringResource(R.string.profile_private_tunnel_clear),
                    icon = Icons.Filled.Close,
                    enabled = state.configImported && !state.isBusy,
                    modifier = Modifier.weight(1f),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ScaledButton(
                    onClick = onStart,
                    label = stringResource(R.string.profile_private_tunnel_start),
                    icon = Icons.Outlined.VpnKey,
                    enabled =
                        state.configImported &&
                            !state.isBusy &&
                            state.status != PrivateTunnelUiStatus.CONNECTED,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = onStop,
                    label = stringResource(R.string.profile_private_tunnel_stop),
                    icon = Icons.Filled.Close,
                    enabled =
                        state.status == PrivateTunnelUiStatus.CONNECTED ||
                            state.status == PrivateTunnelUiStatus.WAITING_EDGE ||
                            state.status == PrivateTunnelUiStatus.RETRYING ||
                            state.status == PrivateTunnelUiStatus.CONNECTING,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
internal fun TunnelMetadataRow(label: String, value: String?) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value?.takeIf { it.isNotBlank() } ?: "—",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End,
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}

@Composable
internal fun ProfileInfoTile(
    icon: ImageVector,
    label: String,
    value: String?,
    emptyPlaceholder: String,
) {
    val display = value?.takeIf { v -> v.isNotBlank() } ?: emptyPlaceholder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = "$label: $display"
                },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = display,
                style = MaterialTheme.typography.bodyLarge,
                color =
                    if (value.isNullOrBlank()) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

