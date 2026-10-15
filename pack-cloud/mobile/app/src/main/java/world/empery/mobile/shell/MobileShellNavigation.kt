/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hybrid shell navigation: NavigationRail on medium+ width, bottom bar on phones and Quest panels.
 *
 * Invariants:
 * - Tab routes and accessibility semantics match legacy bottom navigation.
 * - Notifications is a first-class bottom tab; unread notification count badges that tab (W4 U6).
 * - Bottom nav flattens top corners when media dock is stacked above it.
 * - Central EW hub opens modal quick-pick sheet (MainActivity); bottom nav is never replaced.
 *
 * Related:
 * - MainActivity.kt, RootTab.kt, MobileShellEwHub.kt, LocalMobileWindowLayout.kt
 */
package world.empery.mobile.shell

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import world.empery.mobile.R
import world.empery.mobile.core.ui.LocalMobileUiScale
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileHapticPolicy
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.motionScaleTarget
import world.empery.mobile.core.ui.motionTweenSpec
import world.empery.mobile.core.ui.MobileSurfaceStyle

internal fun isShellTabSelected(currentRoute: String?, tab: RootTab): Boolean =
    currentRoute == tab.route

/** Icon-only rail on Medium/Expanded; labels when expanded rail tier and UI scale allow text. */
internal fun shouldShowShellRailLabels(
    useExpandedNavigationRail: Boolean,
    showsBottomNavLabels: Boolean,
): Boolean = useExpandedNavigationRail && showsBottomNavLabels

@Composable
fun MobileShellBottomNavigation(
    currentRoute: String?,
    profileUpdateAvailable: Boolean,
    totalUnreadChats: Int,
    friendsAttentionCount: Int = 0,
    notificationsUnreadCount: Int = 0,
    navBarContainerColor: Color,
    navBarBorderColor: Color,
    surfaceStyle: MobileSurfaceStyle,
    navController: NavHostController,
    hapticView: android.view.View?,
    reduceMotion: Boolean,
    stackedBelowDock: Boolean = false,
    onOpenEwHubMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val mobileUiScale = LocalMobileUiScale.current
    val navShape =
        if (stackedBelowDock) {
            RoundedCornerShape(0.dp)
        } else {
            RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp)
        }
    Column(modifier = modifier.fillMaxWidth()) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = navShape,
            color = navBarContainerColor,
            tonalElevation = if (stackedBelowDock) 0.dp else 4.dp,
            shadowElevation = if (stackedBelowDock) 0.dp else 18.dp,
            border =
                if (stackedBelowDock) {
                    null
                } else {
                    BorderStroke(1.dp, navBarBorderColor)
                },
        ) {
            Column {
                if (!stackedBelowDock) {
                    PremiumDividerGlow()
                }
                NavigationBar(
                    containerColor = Color.Transparent,
                    tonalElevation = 0.dp,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp),
                ) {
                    MobileShellNavSlots.forEach { slot ->
                        when (slot) {
                            MobileShellNavSlot.EwHub -> {
                                val ewSelected = isEwHubNavHighlighted(currentRoute)
                                val scale by animateFloatAsState(
                                    targetValue = motionScaleTarget(ewSelected, reduceMotion),
                                    animationSpec = motionTweenSpec(180, reduceMotion),
                                    label = "ew_hub_scale",
                                )
                                MobileShellEwHubNavItem(
                                    currentRoute = currentRoute,
                                    selectedScale = scale,
                                    onHubToggle = {
                                        MobileHapticPolicy.performTabSelection(hapticView)
                                        onOpenEwHubMenu()
                                    },
                                )
                            }
                            is MobileShellNavSlot.Root -> {
                                val entry = MobileShellTabEntry(slot.tab)
                                val selected = isShellTabSelected(currentRoute, entry.tab)
                                val scale by animateFloatAsState(
                                    targetValue = motionScaleTarget(selected, reduceMotion),
                                    animationSpec = motionTweenSpec(180, reduceMotion),
                                    label = "nav_icon_scale",
                                )
                                val tabTitle = stringResource(entry.tab.titleRes)
                                val navCd =
                                    shellTabContentDescription(
                                        tab = entry.tab,
                                        tabTitle = tabTitle,
                                        selected = selected,
                                        profileUpdateAvailable = profileUpdateAvailable,
                                        totalUnreadChats = totalUnreadChats,
                                        friendsAttentionCount = friendsAttentionCount,
                                        notificationsUnreadCount = notificationsUnreadCount,
                                    )
                                NavigationBarItem(
                                    modifier =
                                        Modifier.semantics {
                                            role = Role.Tab
                                            this.selected = selected
                                        },
                                    selected = selected,
                                    onClick = {
                                        MobileHapticPolicy.performTabSelection(hapticView)
                                        MobileBackStackPolicy.navigateBottomTab(navController, entry.tab.route)
                                    },
                                        icon = {
                                            MobileShellTabIcon(
                                                entry = entry,
                                                selected = selected,
                                                scale = scale,
                                                contentDescription = navCd,
                                                profileUpdateAvailable = profileUpdateAvailable,
                                                totalUnreadChats = totalUnreadChats,
                                                friendsAttentionCount = friendsAttentionCount,
                                                notificationsUnreadCount = notificationsUnreadCount,
                                            )
                                        },
                                        label =
                                            if (mobileUiScale.showsBottomNavLabels) {
                                                {
                                                    Text(
                                                        text = tabTitle,
                                                        maxLines = 1,
                                                        overflow = TextOverflow.Ellipsis,
                                                        style = MaterialTheme.typography.labelSmall,
                                                    )
                                                }
                                            } else {
                                                null
                                            },
                                        alwaysShowLabel = mobileUiScale.showsBottomNavLabels,
                                        colors =
                                            NavigationBarItemDefaults.colors(
                                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                                indicatorColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.48f),
                                            ),
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
fun MobileShellSideNavigationRail(
    currentRoute: String?,
    profileUpdateAvailable: Boolean,
    totalUnreadChats: Int,
    friendsAttentionCount: Int = 0,
    notificationsUnreadCount: Int = 0,
    navBarContainerColor: Color? = null,
    navBarBorderColor: Color? = null,
    surfaceStyle: MobileSurfaceStyle = MobileSurfaceStyle.SYSTEM,
    navController: NavHostController,
    hapticView: android.view.View?,
    reduceMotion: Boolean,
    onOpenEwHubMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val mobileUiScale = LocalMobileUiScale.current
    val windowLayout = LocalMobileWindowLayout.current
    val showRailLabels =
        shouldShowShellRailLabels(
            useExpandedNavigationRail = windowLayout.useExpandedNavigationRail,
            showsBottomNavLabels = mobileUiScale.showsBottomNavLabels,
        )
    val railWidth = windowLayout.navRailWidthDp.dp
    val scheme = MaterialTheme.colorScheme
    val resolvedContainer =
        navBarContainerColor ?: scheme.surfaceContainer.copy(alpha = 0.94f)
    val resolvedBorder =
        navBarBorderColor ?: scheme.outlineVariant.copy(alpha = 0.32f)
    val railShadowElevation =
        when (surfaceStyle) {
            MobileSurfaceStyle.GLASS -> 4.dp
            MobileSurfaceStyle.PREMIUM -> 8.dp
            MobileSurfaceStyle.SYSTEM -> 2.dp
        }
    Surface(
        modifier =
            modifier
                .fillMaxHeight()
                .then(
                    if (windowLayout.useExpandedNavigationRail) {
                        Modifier.width(railWidth)
                    } else {
                        Modifier
                    },
                ),
        color = resolvedContainer,
        tonalElevation = if (surfaceStyle == MobileSurfaceStyle.PREMIUM) 3.dp else 2.dp,
        shadowElevation = railShadowElevation,
        border = BorderStroke(1.dp, resolvedBorder),
    ) {
        NavigationRail(
            modifier = Modifier.padding(vertical = 8.dp),
            containerColor = Color.Transparent,
        ) {
            MobileShellNavSlots.forEach { slot ->
                when (slot) {
                    MobileShellNavSlot.EwHub -> {
                        val ewSelected = isEwHubNavHighlighted(currentRoute)
                        val scale by animateFloatAsState(
                            targetValue = motionScaleTarget(ewSelected, reduceMotion),
                            animationSpec = motionTweenSpec(180, reduceMotion),
                            label = "ew_rail_scale",
                        )
                        MobileShellEwHubRailItem(
                            currentRoute = currentRoute,
                            selectedScale = scale,
                            onOpenMenu = {
                                MobileHapticPolicy.performTabSelection(hapticView)
                                onOpenEwHubMenu()
                            },
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }
                    is MobileShellNavSlot.Root -> {
                        val entry = MobileShellTabEntry(slot.tab)
                        val selected = isShellTabSelected(currentRoute, entry.tab)
                        val scale by animateFloatAsState(
                            targetValue = motionScaleTarget(selected, reduceMotion),
                            animationSpec = motionTweenSpec(180, reduceMotion),
                            label = "rail_icon_scale",
                        )
                        val tabTitle = stringResource(entry.tab.titleRes)
                        val navCd =
                            shellTabContentDescription(
                                tab = entry.tab,
                                tabTitle = tabTitle,
                                selected = selected,
                                profileUpdateAvailable = profileUpdateAvailable,
                                totalUnreadChats = totalUnreadChats,
                                friendsAttentionCount = friendsAttentionCount,
                                notificationsUnreadCount = notificationsUnreadCount,
                            )
                        NavigationRailItem(
                            modifier =
                                Modifier.semantics {
                                    role = Role.Tab
                                    this.selected = selected
                                },
                            selected = selected,
                            onClick = {
                                MobileHapticPolicy.performTabSelection(hapticView)
                                MobileBackStackPolicy.navigateBottomTab(navController, entry.tab.route)
                            },
                            icon = {
                                MobileShellTabIcon(
                                    entry = entry,
                                    selected = selected,
                                    scale = scale,
                                    contentDescription = navCd,
                                    profileUpdateAvailable = profileUpdateAvailable,
                                    totalUnreadChats = totalUnreadChats,
                                    friendsAttentionCount = friendsAttentionCount,
                                    notificationsUnreadCount = notificationsUnreadCount,
                                )
                            },
                            label =
                                if (showRailLabels) {
                                    {
                                        Text(
                                            text = tabTitle,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            style = MaterialTheme.typography.labelSmall,
                                        )
                                    }
                                } else {
                                    null
                                },
                            alwaysShowLabel = showRailLabels,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MobileShellTabIcon(
    entry: MobileShellTabEntry,
    selected: Boolean,
    scale: Float,
    contentDescription: String,
    profileUpdateAvailable: Boolean,
    totalUnreadChats: Int,
    friendsAttentionCount: Int,
    notificationsUnreadCount: Int = 0,
) {
    val imageVector = if (selected) entry.tab.iconSelected else entry.tab.iconUnselected
    val showUpdateBadge = entry.tab == RootTab.Profile && profileUpdateAvailable
    val showChatUnreadBadge = entry.tab == RootTab.Chat && totalUnreadChats > 0
    val showFriendsAttentionBadge = entry.tab == RootTab.Friends && friendsAttentionCount > 0
    val showNotificationsUnreadBadge =
        entry.tab == RootTab.Notifications && notificationsUnreadCount > 0
    when {
        showUpdateBadge -> {
            BadgedBox(badge = { Badge() }) {
                MobileNavIconTile(imageVector, contentDescription, selected, scale)
            }
        }
        showChatUnreadBadge -> {
            BadgedBox(
                badge = {
                    Badge {
                        Text(
                            text =
                                if (totalUnreadChats > 99) {
                                    "99+"
                                } else {
                                    totalUnreadChats.toString()
                                },
                        )
                    }
                },
            ) {
                MobileNavIconTile(imageVector, contentDescription, selected, scale)
            }
        }
        showFriendsAttentionBadge -> {
            BadgedBox(
                badge = {
                    Badge {
                        Text(
                            text =
                                if (friendsAttentionCount > 99) {
                                    "99+"
                                } else {
                                    friendsAttentionCount.toString()
                                },
                        )
                    }
                },
            ) {
                MobileNavIconTile(imageVector, contentDescription, selected, scale)
            }
        }
        showNotificationsUnreadBadge -> {
            BadgedBox(
                badge = {
                    Badge {
                        Text(
                            text =
                                if (notificationsUnreadCount > 99) {
                                    "99+"
                                } else {
                                    notificationsUnreadCount.toString()
                                },
                        )
                    }
                },
            ) {
                MobileNavIconTile(imageVector, contentDescription, selected, scale)
            }
        }
        else -> MobileNavIconTile(imageVector, contentDescription, selected, scale)
    }
}

@Composable
private fun MobileNavIconTile(
    imageVector: ImageVector,
    contentDescription: String,
    selected: Boolean,
    scale: Float,
) {
    val tint =
        if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        }
    if (selected) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.28f)),
            tonalElevation = 2.dp,
        ) {
            Icon(
                imageVector = imageVector,
                contentDescription = contentDescription,
                tint = tint,
                modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp).scale(scale),
            )
        }
    } else {
        Box(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = imageVector,
                contentDescription = contentDescription,
                tint = tint,
                modifier = Modifier.scale(scale),
            )
        }
    }
}

@Composable
private fun shellTabContentDescription(
    tab: RootTab,
    tabTitle: String,
    selected: Boolean,
    profileUpdateAvailable: Boolean,
    totalUnreadChats: Int,
    friendsAttentionCount: Int,
    notificationsUnreadCount: Int = 0,
): String =
    when {
        tab == RootTab.Profile && profileUpdateAvailable ->
            stringResource(R.string.tab_profile_update_badge_cd)
        tab == RootTab.Chat && totalUnreadChats > 0 ->
            stringResource(R.string.tab_chat_unread_cd, totalUnreadChats)
        tab == RootTab.Friends && friendsAttentionCount > 0 ->
            stringResource(R.string.tab_friends_attention_cd, friendsAttentionCount)
        tab == RootTab.Notifications && notificationsUnreadCount > 0 ->
            stringResource(R.string.tab_notifications_unread_cd, notificationsUnreadCount)
        selected -> stringResource(R.string.tab_nav_selected_cd, tabTitle)
        else -> stringResource(R.string.tab_nav_unselected_cd, tabTitle)
    }

private data class MobileShellTabEntry(val tab: RootTab)

private sealed interface MobileShellNavSlot {
    data class Root(val tab: RootTab) : MobileShellNavSlot

    data object EwHub : MobileShellNavSlot
}

private val MobileShellNavSlots: List<MobileShellNavSlot> =
    listOf(
        MobileShellNavSlot.Root(RootTab.Feed),
        MobileShellNavSlot.Root(RootTab.Chat),
        MobileShellNavSlot.EwHub,
        MobileShellNavSlot.Root(RootTab.Notifications),
        MobileShellNavSlot.Root(RootTab.Friends),
        MobileShellNavSlot.Root(RootTab.Profile),
    )
