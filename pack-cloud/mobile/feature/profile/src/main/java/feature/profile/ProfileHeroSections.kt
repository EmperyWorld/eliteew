/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile hero identity, wallpaper picker, adaptive category slots.
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
internal fun ProfileAdaptiveCategorySlots(
    twoColumn: Boolean,
    slots: List<@Composable () -> Unit>,
) {
    if (twoColumn) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            slots.chunked(2).forEach { rowSlots ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(modifier = Modifier.weight(1f)) { rowSlots[0]() }
                    if (rowSlots.size == 2) {
                        Box(modifier = Modifier.weight(1f)) { rowSlots[1]() }
                    } else {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    } else {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            slots.forEach { slot -> slot() }
        }
    }
}

@Composable
internal fun ProfileHeroIdentityCard(
    profile: ProfileEntity,
    isLoading: Boolean,
    isAvatarUploading: Boolean,
    onAvatarClick: () -> Unit,
    onRefresh: () -> Unit,
    onOpenAccessGate: () -> Unit,
    onLogout: () -> Unit,
) {
    val nameNotSet = stringResource(R.string.profile_name_not_set)
    val displayNameLine = profile.fullName?.takeIf { it.isNotBlank() } ?: nameNotSet
    var menuExpanded by remember { mutableStateOf(false) }
    val refreshCd = stringResource(R.string.profile_refresh_cd)
    val accessGateCd = stringResource(R.string.profile_access_gate_cd)
    val menuCd = stringResource(R.string.profile_hero_menu_cd)
    val chrome = rememberMobileScaleChromePolicy()

    PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ProfileAvatarPlaceholder(
                entity = profile,
                modifier = Modifier.size(72.dp),
                onClick = onAvatarClick,
                isUploading = isAvatarUploading,
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = displayNameLine,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = if (chrome.shouldStackChromeActions) 1 else 2,
                    overflow = TextOverflow.Ellipsis,
                )
                profile.username?.takeIf { it.isNotBlank() }?.let { username ->
                    Text(
                        text = "@$username",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (!chrome.shouldStackChromeActions) {
                    profile.email?.takeIf { it.isNotBlank() }?.let { email ->
                        Text(
                            text = email,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            Box {
                IconButton(
                    onClick = { menuExpanded = true },
                    modifier = Modifier.semantics { contentDescription = menuCd },
                ) {
                    Icon(Icons.Filled.MoreVert, contentDescription = null)
                }
                DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.profile_hero_menu_refresh)) },
                        onClick = {
                            menuExpanded = false
                            onRefresh()
                        },
                        leadingIcon = {
                            if (isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Outlined.Refresh, contentDescription = refreshCd)
                            }
                        },
                        enabled = !isLoading,
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.profile_hero_menu_access)) },
                        onClick = {
                            menuExpanded = false
                            onOpenAccessGate()
                        },
                        leadingIcon = { Icon(Icons.Outlined.OpenInBrowser, contentDescription = accessGateCd) },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.profile_hero_menu_logout)) },
                        onClick = {
                            menuExpanded = false
                            onLogout()
                        },
                        leadingIcon = {
                            Icon(
                                Icons.AutoMirrored.Outlined.Logout,
                                contentDescription = stringResource(R.string.profile_logout_cd),
                                tint = MaterialTheme.colorScheme.error,
                            )
                        },
                    )
                }
            }
        }
    }
}

@Composable
internal fun ProfileWallpaperPickerSection(
    currentBg: String?,
    onPickGallery: () -> Unit,
    onResetWallpaper: () -> Unit,
    onSelectPreset: (String) -> Unit,
) {
    val context = LocalContext.current
    var presetsExpanded by rememberSaveable { mutableStateOf(false) }

    ProfileSectionCard(
        title = stringResource(R.string.profile_wallpaper_section),
        subtitle = stringResource(R.string.profile_wallpaper_hint),
        icon = Icons.Outlined.PhotoLibrary,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ScaledButton(
                    onClick = onPickGallery,
                    label = stringResource(R.string.profile_gallery),
                    icon = Icons.Outlined.Image,
                    enabled = true,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = onResetWallpaper,
                    label = stringResource(R.string.profile_reset_wallpaper),
                    icon = Icons.Outlined.RestartAlt,
                    enabled = true,
                    modifier = Modifier.weight(1f),
                )
            }
            ScaledOutlinedButton(
                onClick = { presetsExpanded = !presetsExpanded },
                label =
                    stringResource(
                        if (presetsExpanded) {
                            R.string.profile_wallpaper_collapse
                        } else {
                            R.string.profile_wallpaper_expand
                        },
                    ),
                icon = if (presetsExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                enabled = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (presetsExpanded) {
                LazyRow(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(29) { index ->
                        val i = index + 1
                        val resName = "wp_$i"
                        val resId = context.resources.getIdentifier(resName, "drawable", context.packageName)
                        if (resId != 0) {
                            val uriString = "android.resource://${context.packageName}/drawable/$resName"
                            val isSelected = currentBg == uriString
                            val thumbShape = RoundedCornerShape(16.dp)
                            Surface(
                                modifier =
                                    Modifier
                                        .size(width = 88.dp, height = 132.dp)
                                        .clip(thumbShape)
                                        .clickable { onSelectPreset(uriString) },
                                shape = thumbShape,
                                tonalElevation = if (isSelected) 5.dp else 2.dp,
                                border =
                                    if (isSelected) {
                                        BorderStroke(3.dp, MaterialTheme.colorScheme.primary)
                                    } else {
                                        BorderStroke(
                                            1.dp,
                                            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                                        )
                                    },
                                color =
                                    if (isSelected) {
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.44f)
                                    } else {
                                        MaterialTheme.colorScheme.surfaceContainerHigh
                                    },
                            ) {
                                coil.compose.AsyncImage(
                                    model = resId,
                                    contentDescription = stringResource(R.string.profile_wallpaper_thumb_cd, i),
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun ProfileActionIconButton(
    icon: ImageVector,
    contentDescription: String,
    tint: Color,
    enabled: Boolean,
    isBusy: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = tint.copy(alpha = if (enabled) 0.14f else 0.06f),
        border = BorderStroke(1.dp, tint.copy(alpha = if (enabled) 0.42f else 0.16f)),
        tonalElevation = 2.dp,
    ) {
        IconButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.mobileMinimumTouchTarget(),
        ) {
            if (isBusy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = tint,
                )
            } else {
                Icon(
                    icon,
                    contentDescription = contentDescription,
                    tint = if (enabled) tint else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
                )
            }
        }
    }
}
