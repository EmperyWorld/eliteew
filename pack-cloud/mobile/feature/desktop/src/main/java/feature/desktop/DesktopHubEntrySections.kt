/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub LazyColumn entry sections: remote dashboard, shell, SPA launches, handoff, and config.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 * - LazyColumn item order must stay aligned with DesktopHubLazyColumnIndices / DesktopHubSectionId.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubLogic.kt, DesktopHubDeepLinkSupport.kt
 */
package feature.desktop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Notes
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.ScaledOutlinedButton

@Composable
internal fun DesktopHubRemoteDashboardSection(state: DesktopHubUiState) {
    val summary = state.toRemoteDashboardSummary()
    DesktopSectionCard(
        title = stringResource(R.string.desktop_remote_dashboard_title),
        subtitle = stringResource(R.string.desktop_remote_dashboard_hint),
        icon = Icons.Outlined.Settings,
    ) {
        PremiumMetricPill(
            label = stringResource(R.string.desktop_stat_installed),
            value = summary.installedCount.toString(),
            modifier = Modifier.fillMaxWidth(),
        )
        PremiumMetricPill(
            label = stringResource(R.string.desktop_stat_pending),
            value = summary.pendingTodos.toString(),
            modifier = Modifier.fillMaxWidth(),
        )
        summary.nowPlayingTitle?.let {
            Text(
                stringResource(R.string.desktop_shell_now_playing, it),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
internal fun DesktopHubShellStateSection(
    state: DesktopHubUiState,
    quietMode: Boolean,
    quietToggleCd: String,
    isLoading: Boolean,
    onToggleQuietMode: () -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_shell_state_title),
        subtitle = null,
        icon = Icons.Outlined.Checklist,
    ) {
        val lines = state.shellState?.toSnapshotLines().orEmpty()
        if (lines.isEmpty()) {
            Text(stringResource(R.string.desktop_value_dash))
        } else {
            lines.forEach { line ->
                val label = when (line.labelKey) {
                    "quiet_mode" -> if (line.value == "on") {
                        stringResource(R.string.desktop_shell_quiet_on)
                    } else {
                        stringResource(R.string.desktop_shell_quiet_off)
                    }
                    "now_playing" -> stringResource(R.string.desktop_shell_now_playing, line.value)
                    "playlists" -> stringResource(R.string.desktop_shell_playlists, line.value)
                    else -> line.value
                }
                Text(label, style = MaterialTheme.typography.bodySmall)
            }
        }
        ScaledOutlinedButton(
            onClick = onToggleQuietMode,
            enabled = !isLoading,
            label =
                if (quietMode) {
                    stringResource(R.string.desktop_quiet_mode_disable)
                } else {
                    stringResource(R.string.desktop_quiet_mode_enable)
                },
            modifier = Modifier.semantics {
                contentDescription = quietToggleCd
            },
        )
    }
}

@Composable
internal fun DesktopHubSpaEntrySection(
    titleRes: Int,
    subtitleRes: Int,
    openLabelRes: Int,
    icon: ImageVector,
    onOpen: () -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(titleRes),
        subtitle = stringResource(subtitleRes),
        icon = icon,
    ) {
        Button(onClick = onOpen) {
            Text(stringResource(openLabelRes))
        }
    }
}

@Composable
internal fun DesktopHubHandoffSection(
    handoffDraftText: String,
    handoffDraft: DesktopHandoffDraft?,
    onHandoffDraftChange: (String) -> Unit,
    onSaveHandoffDraft: () -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_handoff_title),
        subtitle = stringResource(R.string.desktop_handoff_hint),
        icon = Icons.AutoMirrored.Outlined.Notes,
    ) {
        OutlinedTextField(
            value = handoffDraftText,
            onValueChange = onHandoffDraftChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        handoffDraft?.takeIf { it.recovered }?.let {
            Text(
                stringResource(R.string.desktop_handoff_expired),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Button(onClick = onSaveHandoffDraft, enabled = handoffDraftText.isNotBlank()) {
            Text(stringResource(R.string.desktop_handoff_save))
        }
    }
}

@Composable
internal fun DesktopHubConfigSection(
    state: DesktopHubUiState,
    currentThemeLabel: String,
    nextThemeLabel: String,
    quietModeLabel: String,
    dashLabel: String,
    themeCycleCd: String,
    isLoading: Boolean,
    gridGap: Dp,
    onCycleTheme: () -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_config_section_title),
        subtitle = stringResource(R.string.desktop_config_section_hint),
        icon = Icons.Outlined.Settings,
    ) {
        Text(stringResource(R.string.desktop_config_theme_line, currentThemeLabel))
        Text(
            stringResource(
                R.string.desktop_config_wallpaper_line,
                formatWallpaperSummaryForUi(state.config?.wallpaper),
            ),
        )
        Text(
            stringResource(
                R.string.desktop_config_now_playing_line,
                state.shellState?.now_playing?.track?.name ?: dashLabel,
            ),
        )
        Text(stringResource(R.string.desktop_config_quiet_mode_line, quietModeLabel))
        Row(
            horizontalArrangement = Arrangement.spacedBy(gridGap),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            ScaledOutlinedButton(
                onClick = onCycleTheme,
                enabled = !isLoading,
                label = stringResource(R.string.desktop_theme_cycle_to, nextThemeLabel),
                icon = Icons.Outlined.Palette,
                modifier =
                    Modifier
                        .weight(1f)
                        .semantics {
                            contentDescription = themeCycleCd
                        },
            )
        }
    }
}
