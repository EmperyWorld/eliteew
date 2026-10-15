/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composable helpers for width-aware content: adaptive column counts and optional readable max-width zones.
 *
 * Invariants:
 * - Shell/tabs use full window width; [MobileAdaptiveContent] is for optional inner readable zones only.
 *
 * Related:
 * - LocalMobileWindowLayout.kt, MobileDesignTokens.kt, MobileScaleChromeLayout.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun MobileAdaptiveContent(
    modifier: Modifier = Modifier,
    layout: MobileWindowLayout = LocalMobileWindowLayout.current,
    content: @Composable () -> Unit,
) {
    val maxWidth = layout.contentMaxWidthDp.dp
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .widthIn(max = maxWidth),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            content()
        }
    }
}

@Composable
fun MobileAdaptiveColumns(
    modifier: Modifier = Modifier,
    layout: MobileWindowLayout = LocalMobileWindowLayout.current,
    requestedColumns: Int? = null,
    content: @Composable (columnCount: Int) -> Unit,
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val minCell = layout.gridMinCellWidthDp.dp
        val maxByWidth =
            if (minCell.value > 0f) {
                (maxWidth / minCell).toInt().coerceAtLeast(1)
            } else {
                1
            }
        val target = requestedColumns ?: layout.effectiveContentColumnCount
        val columnCount = target.coerceIn(1, maxByWidth.coerceAtMost(layout.effectiveContentColumnCount))
        content(columnCount)
    }
}
