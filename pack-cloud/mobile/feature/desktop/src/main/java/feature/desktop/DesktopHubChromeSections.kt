/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub chrome: section titles, jump row, section card shell, and metric pills.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 *
 * Related:
 * - DesktopHubFeature.kt
 */
package feature.desktop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumSectionCard

internal fun hubA11ySnippet(text: String, maxChars: Int = 72): String {
    val t = text.trim()
    if (t.length <= maxChars) return t
    return t.take(maxChars).trimEnd() + "…"
}

@Composable
internal fun formatWallpaperSummaryForUi(raw: String?): String {
    val s = raw?.trim().orEmpty()
    if (s.isEmpty()) return stringResource(R.string.desktop_value_dash)
    if (s.startsWith("data:", ignoreCase = true)) {
        val comma = s.indexOf(',')
        val payload = if (comma >= 0 && comma < s.length - 1) s.substring(comma + 1) else s
        val approxKb = maxOf(1L, (payload.length * 3L) / (4L * 1024L))
        val mime = if (comma > 5) {
            s.substring(5, comma).substringBefore(';').ifBlank { "image" }
        } else {
            "image"
        }
        return stringResource(R.string.desktop_wallpaper_embedded_summary, mime, approxKb)
    }
    val maxLen = 96
    if (s.length <= maxLen) return s
    return s.take(maxLen - 1).trimEnd() + "…"
}

@Composable
internal fun desktopThemeDisplayLabel(theme: String?): String {
    val key = theme?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
    return when (key) {
        "DARK" -> stringResource(R.string.desktop_theme_dark)
        "LIGHT" -> stringResource(R.string.desktop_theme_light)
        "AUTO" -> stringResource(R.string.desktop_theme_auto)
        null -> stringResource(R.string.desktop_value_dash)
        else -> theme.trim()
    }
}

@Composable
internal fun desktopQuietModeDisplayLabel(quiet: Boolean?): String =
    if (quiet == true) {
        stringResource(R.string.desktop_quiet_mode_on_label)
    } else {
        stringResource(R.string.desktop_quiet_mode_off_label)
    }

@Composable
internal fun desktopHubSectionTitle(section: DesktopHubSectionId): String =
    when (section) {
        DesktopHubSectionId.REMOTE_DASHBOARD -> stringResource(R.string.desktop_remote_dashboard_title)
        DesktopHubSectionId.SHELL_STATE -> stringResource(R.string.desktop_shell_state_title)
        DesktopHubSectionId.EWA -> stringResource(R.string.desktop_ewa_entry_title)
        DesktopHubSectionId.HANDOFF -> stringResource(R.string.desktop_handoff_title)
        DesktopHubSectionId.CONFIG -> stringResource(R.string.desktop_config_section_title)
        DesktopHubSectionId.NOTES -> stringResource(R.string.desktop_notes_section_title)
        DesktopHubSectionId.TODOS -> stringResource(R.string.desktop_todos_section_title)
        DesktopHubSectionId.FAVORITES -> stringResource(R.string.desktop_favorites_section_title)
        DesktopHubSectionId.STORE -> stringResource(R.string.desktop_store_section_title)
    }

@Composable
internal fun DesktopHubSectionJumpRow(
    listState: LazyListState,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    LazyRow(
        modifier = modifier.semantics { isTraversalGroup = true },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(DESKTOP_HUB_QUICK_JUMP_SECTIONS, key = { it.name }) { section ->
            val title = desktopHubSectionTitle(section)
            FilterChip(
                selected = false,
                onClick = {
                    scope.launch {
                        listState.animateScrollToItem(section.lazyListIndex)
                    }
                },
                label = {
                    Text(
                        title,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                modifier =
                    Modifier.semantics {
                        contentDescription =
                            context.getString(R.string.desktop_section_jump_cd, title)
                    },
            )
        }
    }
}

@Composable
internal fun DesktopSectionCard(
    title: String,
    subtitle: String?,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    PremiumSectionCard(
        title = title,
        subtitle = subtitle,
        icon = icon,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { isTraversalGroup = true },
        content = content,
    )
}

@Composable
internal fun HubStatPill(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    accessibilityLabel: String,
) {
    PremiumMetricPill(
        modifier =
            modifier
                .heightIn(min = 56.dp)
                .semantics(mergeDescendants = true) {
                    contentDescription = accessibilityLabel
                    isTraversalGroup = true
                },
        label = label,
        value = value,
    )
}


@Composable
internal fun DesktopHubChromeStatsRow(
    currentThemeLabel: String,
    installedCount: Int,
    pendingTodos: Int,
    stackChrome: Boolean,
    gridGap: Dp,
) {
    if (stackChrome) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .semantics { isTraversalGroup = true },
            verticalArrangement = Arrangement.spacedBy(gridGap),
        ) {
            HubStatPill(
                modifier = Modifier.fillMaxWidth(),
                label = stringResource(R.string.desktop_stat_theme),
                value = currentThemeLabel,
                accessibilityLabel = stringResource(R.string.desktop_stat_theme_a11y, currentThemeLabel),
            )
            HubStatPill(
                modifier = Modifier.fillMaxWidth(),
                label = stringResource(R.string.desktop_stat_installed),
                value = installedCount.toString(),
                accessibilityLabel = stringResource(R.string.desktop_stat_installed_a11y, installedCount),
            )
            HubStatPill(
                modifier = Modifier.fillMaxWidth(),
                label = stringResource(R.string.desktop_stat_pending),
                value = pendingTodos.toString(),
                accessibilityLabel = stringResource(R.string.desktop_stat_pending_a11y, pendingTodos),
            )
        }
    } else {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .semantics { isTraversalGroup = true },
            horizontalArrangement = Arrangement.spacedBy(gridGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HubStatPill(
                modifier = Modifier.weight(1f),
                label = stringResource(R.string.desktop_stat_theme),
                value = currentThemeLabel,
                accessibilityLabel = stringResource(R.string.desktop_stat_theme_a11y, currentThemeLabel),
            )
            HubStatPill(
                modifier = Modifier.weight(1f),
                label = stringResource(R.string.desktop_stat_installed),
                value = installedCount.toString(),
                accessibilityLabel = stringResource(R.string.desktop_stat_installed_a11y, installedCount),
            )
            HubStatPill(
                modifier = Modifier.weight(1f),
                label = stringResource(R.string.desktop_stat_pending),
                value = pendingTodos.toString(),
                accessibilityLabel = stringResource(R.string.desktop_stat_pending_a11y, pendingTodos),
            )
        }
    }
}
