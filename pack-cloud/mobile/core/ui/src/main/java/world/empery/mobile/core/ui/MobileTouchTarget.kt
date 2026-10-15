/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensures interactive controls meet the 48dp minimum touch target guideline.
 *
 * Invariants:
 * - Applies sizeIn only; does not change click handling.
 *
 * Related:
 * MobileDesignTokens.kt, Material accessibility guidance
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

val MobileMinimumTouchTargetDp = 48.dp

fun minimumTouchTargetDpForUiScale(uiScale: MobileUiScale): Dp =
    resolveMobileScaleChromePolicy(uiScale, systemFontScale = 1f).minimumTouchTargetDp

fun Modifier.mobileMinimumTouchTarget(uiScale: MobileUiScale = MobileUiScale.STANDARD): Modifier {
    val min = minimumTouchTargetDpForUiScale(uiScale)
    return sizeIn(minWidth = min, minHeight = min)
}

@Composable
fun Modifier.mobileMinimumTouchTarget(): Modifier {
    val policy = rememberMobileScaleChromePolicy()
    return sizeIn(minWidth = policy.minimumTouchTargetDp, minHeight = policy.minimumTouchTargetDp)
}

@Composable
fun MobileIconButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier =
            modifier.semantics {
                this.contentDescription = contentDescription
            }.mobileMinimumTouchTarget(),
    ) {
        content()
    }
}
