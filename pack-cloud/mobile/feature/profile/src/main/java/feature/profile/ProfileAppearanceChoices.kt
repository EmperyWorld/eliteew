/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared premium choice tiles for Profile appearance — UI scale picker and reusable option rows.
 *
 * Invariants:
 * - Scale picker lists every [MobileUiScale] preset with a short description for the selected row.
 * - Uses [MobileScaleChromePolicy] for stacked layout on COMFORT / large system font.
 *
 * Related:
 * - ProfileAppearanceSection.kt, MobileUiScale.kt, MOBILE-ANDROID-SCALE-CHROME-POLICY.md
 */
package feature.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
fun ProfileUiScalePicker(
    selected: MobileUiScale,
    onSelect: (MobileUiScale) -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        MobileUiScale.entries.forEach { scale ->
            ProfileChoiceTile(
                label = stringResource(scale.chipLabelRes),
                icon = Icons.Outlined.TextFields,
                selected = selected == scale,
                onClick = { onSelect(scale) },
            )
        }
        Text(
            text = stringResource(selected.chipDescriptionRes),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = if (chrome.shouldStackChromeActions) 3 else 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun ProfileChoiceTile(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 64.dp)
                .clickable(onClick = onClick),
        containerColor =
            if (selected) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f)
            } else {
                null
            },
        borderColor =
            if (selected) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
            } else {
                null
            },
        tonalElevation = if (selected) 3.dp else null,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PremiumIconTile(
                icon = icon,
                contentDescription = null,
                modifier = Modifier.size(44.dp),
                containerColor =
                    if (selected) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
                    } else {
                        MaterialTheme.colorScheme.surface.copy(alpha = 0.72f)
                    },
                contentColor =
                    if (selected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
            )
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color =
                    if (selected) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                modifier = Modifier.weight(1f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (selected) {
                androidx.compose.material3.Icon(
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}
