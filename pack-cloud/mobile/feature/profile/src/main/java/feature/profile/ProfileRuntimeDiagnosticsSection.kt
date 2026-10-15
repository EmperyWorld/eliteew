/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap analytics-004: runtime diagnostics card in Profile (flavor, socket, motion, QA toggles).
 *
 * Invariants:
 * - No raw tokens; sensitive rows masked.
 * - Expanded state persisted via MobileFeatureShellPreferences (app layer passes callbacks).
 *
 * Related:
 * - ProfileFeature.kt, MobileShellRoadmapSupport.kt
 */
package feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumSectionCard

data class RuntimeDiagnosticsUiState(
    val rows: List<RuntimeDiagnosticsUiRow> = emptyList(),
    val expanded: Boolean = false,
    val analyticsEnabled: Boolean = true,
    val fontStressEnabled: Boolean = false,
)

data class RuntimeDiagnosticsUiRow(
    val label: String,
    val value: String,
    val masked: Boolean = false,
)

@Composable
fun ProfileRuntimeDiagnosticsSection(
    state: RuntimeDiagnosticsUiState,
    onExpandedChange: (Boolean) -> Unit,
    onAnalyticsEnabledChange: (Boolean) -> Unit,
    onFontStressChange: (Boolean) -> Unit,
) {
    PremiumSectionCard(
        title = stringResource(R.string.profile_runtime_diag_title),
        subtitle = stringResource(R.string.profile_runtime_diag_subtitle),
        icon = Icons.Outlined.BugReport,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(R.string.profile_runtime_diag_expand))
                Switch(checked = state.expanded, onCheckedChange = onExpandedChange)
            }
            if (state.expanded) {
                state.rows.forEach { row ->
                    DiagRow(
                        label = row.label,
                        value = if (row.masked) maskDiagValue(row.value) else row.value,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.profile_runtime_diag_analytics))
                    Switch(checked = state.analyticsEnabled, onCheckedChange = onAnalyticsEnabledChange)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.profile_runtime_diag_font_stress))
                    Switch(checked = state.fontStressEnabled, onCheckedChange = onFontStressChange)
                }
            }
        }
    }
}

@Composable
private fun DiagRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}

private fun maskDiagValue(raw: String): String {
    val t = raw.trim()
    if (t.length <= 8) return "••••"
    return t.take(4) + "…" + t.takeLast(4)
}
