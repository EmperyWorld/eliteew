/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composable layout slots driven by [MobileScaleChromePolicy] — stack vs inline chrome rows,
 * optional inline-only actions, and width-aware adaptive chrome from [MobileAdaptiveLayout].
 *
 * Invariants:
 * - Features consume these helpers instead of duplicating `if (chrome.shouldStackChromeActions)`.
 * - [MobileScaleChromeInlineOnly] hides content when stacking; callers must not rely on side effects inside.
 *
 * Related:
 * - MobileScaleChromePolicy.kt, MobileAdaptiveLayout.kt, ScaledActionButtons.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun MobileScaleChromeStackOrRow(
    modifier: Modifier = Modifier,
    policy: MobileScaleChromePolicy = rememberMobileScaleChromePolicy(),
    horizontalSpacing: Dp = 8.dp,
    verticalSpacing: Dp = 8.dp,
    verticalAlignment: Alignment.Vertical = Alignment.CenterVertically,
    content: @Composable () -> Unit,
) {
    if (policy.shouldStackChromeActions) {
        Column(
            modifier = modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(verticalSpacing),
        ) {
            content()
        }
    } else {
        Row(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(horizontalSpacing),
            verticalAlignment = verticalAlignment,
        ) {
            content()
        }
    }
}

@Composable
fun MobileScaleChromeInlineOnly(
    policy: MobileScaleChromePolicy = rememberMobileScaleChromePolicy(),
    content: @Composable () -> Unit,
) {
    if (policy.showInlineRowQuickActions) {
        content()
    }
}

@Composable
fun MobileScaleChromeStackedOnly(
    policy: MobileScaleChromePolicy = rememberMobileScaleChromePolicy(),
    content: @Composable ColumnScope.() -> Unit,
) {
    if (policy.shouldStackChromeActions) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content,
        )
    }
}

@Composable
fun MobileScaleChromeInlineRow(
    modifier: Modifier = Modifier,
    policy: MobileScaleChromePolicy = rememberMobileScaleChromePolicy(),
    horizontalSpacing: Dp = 8.dp,
    verticalAlignment: Alignment.Vertical = Alignment.CenterVertically,
    content: @Composable RowScope.() -> Unit,
) {
    if (!policy.shouldStackChromeActions) {
        Row(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(horizontalSpacing),
            verticalAlignment = verticalAlignment,
            content = content,
        )
    }
}

@Composable
fun MobileAdaptiveChromeContent(
    modifier: Modifier = Modifier,
    layout: MobileWindowLayout = LocalMobileWindowLayout.current,
    policy: MobileScaleChromePolicy = rememberMobileScaleChromePolicy(),
    content: @Composable () -> Unit,
) {
    MobileAdaptiveContent(modifier = modifier, layout = layout) {
        if (policy.shouldStackChromeActions) {
            Column(modifier = Modifier.fillMaxWidth()) {
                content()
            }
        } else {
            content()
        }
    }
}
