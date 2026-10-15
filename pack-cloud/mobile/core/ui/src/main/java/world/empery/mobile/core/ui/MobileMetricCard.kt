/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified metric/stat card for shell dashboards and notification header.
 *
 * Invariants:
 * - Visual-only; values are supplied by feature ViewModels.
 * - Container/border follow GLASS/PREMIUM/SYSTEM tokens like PremiumMetricPill.
 *
 * Related:
 * PremiumMetricPill.kt, NotificationFeature.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun MobileMetricCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val scheme = MaterialTheme.colorScheme
    val style = LocalMobileSurfaceStyle.current
    val containerAlpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.58f
            MobileSurfaceStyle.PREMIUM -> 0.94f
            MobileSurfaceStyle.SYSTEM -> 0.82f
        }
    val borderColor =
        when (style) {
            MobileSurfaceStyle.GLASS -> Color.White.copy(alpha = 0.42f)
            MobileSurfaceStyle.PREMIUM -> scheme.primary.copy(alpha = 0.38f)
            MobileSurfaceStyle.SYSTEM -> scheme.outlineVariant.copy(alpha = 0.45f)
        }
    val radii = MobileDesignTokens.radii
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(radii.md),
        color = scheme.surfaceContainerHigh.copy(alpha = containerAlpha),
        border = BorderStroke(1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = MobileDesignTokens.spacing.sm, vertical = MobileDesignTokens.spacing.xs + 1.dp),
            horizontalArrangement = Arrangement.spacedBy(MobileDesignTokens.spacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = scheme.primary,
                )
            }
            Column {
                Text(text = label, style = MobileDesignTokens.metricLabelStyle(), color = scheme.onSurfaceVariant)
                Text(text = value, style = MobileDesignTokens.metricValueStyle(), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
