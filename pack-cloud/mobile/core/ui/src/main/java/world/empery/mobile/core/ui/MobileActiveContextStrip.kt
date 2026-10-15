/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shows the active workspace/tab context above nested flows.
 *
 * Invariants:
 * - Display-only; navigation callbacks are provided by the shell.
 *
 * Related:
 * MobileRouteRegistry.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow

@Composable
fun MobileActiveContextStrip(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    detail: String? = null,
) {
    val radii = MobileDesignTokens.radii
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(radii.md),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f),
        tonalElevation = MobileDesignTokens.sectionElevation,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = MobileDesignTokens.spacing.sm, vertical = MobileDesignTokens.spacing.xs),
            horizontalArrangement = Arrangement.spacedBy(MobileDesignTokens.spacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!detail.isNullOrBlank()) {
                    Text(
                        text = detail,
                        style = MobileDesignTokens.bodyMutedStyle(),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
