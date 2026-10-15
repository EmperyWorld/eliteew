/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central EW hub: launcher tab + premium modal quick-pick sheet (M3 pattern — scrim blocks bottom nav).
 *
 * Invariants:
 * - Quick pick is a ModalBottomSheet over content; bottom nav stays unchanged underneath scrim.
 * - Sheet uses PremiumHeroHeader / PremiumRowSurface (same tokens as UGS hub and content library).
 * - No DropdownMenu/popup/nav replacement — avoids ghost taps on adjacent tabs.
 *
 * Related:
 * - MobileShellNavigation.kt, MainActivity.kt, MobileBackStackPolicy.kt
 */
package world.empery.mobile.shell

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.R
import world.empery.mobile.core.ui.PremiumHeroHeader
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumRowSurface

/** UGS hub root only — nested screens do not count as “hub home”. */
internal fun isEwHubRouteSelected(currentRoute: String?): Boolean {
    if (currentRoute.isNullOrBlank()) return false
    return currentRoute == RootTab.Ugs.route
}

/** Nested UGS flows still highlight EW control in the bottom bar. */
internal fun isEwHubNavHighlighted(currentRoute: String?): Boolean {
    if (currentRoute.isNullOrBlank()) return false
    if (currentRoute == RootTab.Ugs.route) return true
    return currentRoute.startsWith("ugs/")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RowScope.MobileShellEwHubNavItem(
    currentRoute: String?,
    selectedScale: Float,
    onHubToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val routeSelected = isEwHubNavHighlighted(currentRoute)
    val hubCd = stringResource(R.string.ew_hub_nav_cd)

    NavigationBarItem(
        modifier =
            modifier.semantics {
                role = Role.Tab
                selected = routeSelected
                contentDescription = hubCd
            },
        selected = routeSelected,
        onClick = onHubToggle,
        icon = {
            EwHubLauncherChip(
                selectedScale = selectedScale,
                visuallySelected = routeSelected,
            )
        },
        label = null,
        alwaysShowLabel = false,
        colors = ewHubNavItemColors(),
    )
}

/** Modal quick-pick — same Premium sheet pattern as UGS / media player. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MobileShellEwHubMenuSheet(
    visible: Boolean,
    onDismiss: () -> Unit,
    onOpenEwaCompanion: () -> Unit,
    onOpenHandbook: () -> Unit,
    onOpenSocialHub: () -> Unit,
    onOpenFeedbackHub: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenAi: () -> Unit,
    onOpenMusic: () -> Unit,
    onOpenFiles: () -> Unit,
    onOpenProfessionalWorlds: () -> Unit,
    onOpenAppStore: () -> Unit,
    onOpenDesktopSettings: () -> Unit,
    onOpenEwDesk: () -> Unit,
) {
    if (!visible) return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val configuration = LocalConfiguration.current
    val sheetMaxHeight = (configuration.screenHeightDp * 0.88f).dp

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.92f),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = sheetMaxHeight)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PremiumHeroHeader(
                title = stringResource(R.string.ew_hub_sheet_title),
                subtitle = stringResource(R.string.ew_hub_sheet_subtitle),
                icon = Icons.Outlined.AutoAwesome,
                trailing = {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = stringResource(R.string.ew_hub_close_cd),
                        )
                    }
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.SmartToy,
                title = stringResource(R.string.ew_hub_ewa_cd),
                subtitle = stringResource(R.string.ew_hub_ewa_subtitle),
                onClick = {
                    onDismiss()
                    onOpenEwaCompanion()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.MenuBook,
                title = stringResource(R.string.ew_hub_handbook_cd),
                subtitle = stringResource(R.string.ew_hub_handbook_subtitle),
                onClick = {
                    onDismiss()
                    onOpenHandbook()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.People,
                title = stringResource(R.string.ew_hub_social_hub_cd),
                subtitle = stringResource(R.string.ew_hub_social_hub_subtitle),
                onClick = {
                    onDismiss()
                    onOpenSocialHub()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.ChatBubbleOutline,
                title = stringResource(R.string.ew_hub_feedback_cd),
                subtitle = stringResource(R.string.ew_hub_feedback_subtitle),
                onClick = {
                    onDismiss()
                    onOpenFeedbackHub()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.Notifications,
                title = stringResource(R.string.ew_hub_notifications_cd),
                subtitle = stringResource(R.string.ew_hub_notifications_subtitle),
                onClick = {
                    onDismiss()
                    onOpenNotifications()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.FolderOpen,
                title = stringResource(R.string.ew_hub_files_cd),
                subtitle = stringResource(R.string.ew_hub_files_subtitle),
                onClick = {
                    onDismiss()
                    onOpenFiles()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.Work,
                title = stringResource(R.string.ew_hub_professional_worlds_cd),
                subtitle = stringResource(R.string.ew_hub_professional_worlds_subtitle),
                onClick = {
                    onDismiss()
                    onOpenProfessionalWorlds()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.Store,
                title = stringResource(R.string.ew_hub_app_store_cd),
                subtitle = stringResource(R.string.ew_hub_app_store_subtitle),
                onClick = {
                    onDismiss()
                    onOpenAppStore()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.Settings,
                title = stringResource(R.string.ew_hub_desktop_settings_cd),
                subtitle = stringResource(R.string.ew_hub_desktop_settings_subtitle),
                onClick = {
                    onDismiss()
                    onOpenDesktopSettings()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.Newspaper,
                title = stringResource(R.string.ew_hub_ewdesk_cd),
                subtitle = stringResource(R.string.ew_hub_ewdesk_subtitle),
                onClick = {
                    onDismiss()
                    onOpenEwDesk()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.LibraryMusic,
                title = stringResource(R.string.ew_hub_music_cd),
                subtitle = stringResource(R.string.ew_hub_music_subtitle),
                onClick = {
                    onDismiss()
                    onOpenMusic()
                },
            )
            EwHubMenuActionRow(
                icon = Icons.Outlined.AutoAwesome,
                title = stringResource(R.string.ew_hub_ai_cd),
                subtitle = stringResource(R.string.ew_hub_ai_subtitle),
                onClick = {
                    onDismiss()
                    onOpenAi()
                },
            )
        }
    }
}

@Composable
private fun EwHubMenuActionRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    PremiumRowSurface(
        modifier = Modifier.clickable(onClick = onClick),
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.88f),
        borderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f),
        tonalElevation = 2.dp,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PremiumIconTile(
            icon = icon,
            contentDescription = null,
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Icon(
            imageVector = Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun EwHubLauncherChip(
    selectedScale: Float,
    visuallySelected: Boolean,
) {
    Surface(
        modifier = Modifier.scale(selectedScale),
        shape = CircleShape,
        color =
            if (visuallySelected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f)
            },
        border =
            BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.primary.copy(alpha = if (visuallySelected) 0.55f else 0.28f),
            ),
        shadowElevation = if (visuallySelected) 10.dp else 6.dp,
        tonalElevation = 2.dp,
    ) {
        Text(
            text = stringResource(R.string.ew_hub_nav_label),
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color =
                if (visuallySelected) {
                    MaterialTheme.colorScheme.onPrimary
                } else {
                    MaterialTheme.colorScheme.onPrimaryContainer
                },
        )
    }
}

@Composable
private fun ewHubNavItemColors() =
    NavigationBarItemDefaults.colors(
        selectedIconColor = MaterialTheme.colorScheme.primary,
        selectedTextColor = MaterialTheme.colorScheme.primary,
        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
        indicatorColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.24f),
    )

@Composable
fun MobileShellEwHubRailItem(
    currentRoute: String?,
    selectedScale: Float,
    onOpenMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val routeSelected = isEwHubNavHighlighted(currentRoute)
    val hubCd = stringResource(R.string.ew_hub_nav_cd)

    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            onClick = onOpenMenu,
            shape = CircleShape,
            color =
                if (routeSelected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f)
                },
            border =
                BorderStroke(
                    1.dp,
                    MaterialTheme.colorScheme.primary.copy(alpha = if (routeSelected) 0.55f else 0.28f),
                ),
            shadowElevation = if (routeSelected) 8.dp else 4.dp,
            modifier =
                Modifier
                    .semantics {
                        role = Role.Tab
                        selected = routeSelected
                        contentDescription = hubCd
                    }
                    .scale(selectedScale),
        ) {
            Text(
                text = stringResource(R.string.ew_hub_nav_label),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color =
                    if (routeSelected) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    },
            )
        }
    }
}
