/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated shell content wrapper and nested-route context scaffold above feature screens.
 *
 * Invariants:
 * - NavHost uses full activity width between nav chrome and edges; no shell max-width cap.
 * - Nested context strip is display-only; back navigation stays in feature modules.
 * - Readable max-width (chat thread, bubbles) stays in feature modules only.
 *
 * Related:
 * - MainActivity.kt, MobileActiveContextStrip.kt, LocalMobileWindowLayout.kt
 */
package world.empery.mobile.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileActiveContextStrip
import world.empery.mobile.core.ui.MobileWindowWidthClass

@Composable
fun MobileShellContentFrame(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        content()
    }
}

@Composable
fun MobileShellNestedContextScaffold(
    label: String,
    detail: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val windowLayout = LocalMobileWindowLayout.current
    val horizontalPadding =
        when (windowLayout.widthClass) {
            MobileWindowWidthClass.Large,
            MobileWindowWidthClass.ExtraLarge,
            -> 16.dp
            else -> 12.dp
        }
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MobileActiveContextStrip(
            label = label,
            detail = detail,
            icon = icon,
            modifier =
                Modifier.padding(
                    horizontal = horizontalPadding,
                    vertical = 4.dp,
                ),
        )
        Box(modifier = Modifier.fillMaxSize()) {
            content()
        }
    }
}
