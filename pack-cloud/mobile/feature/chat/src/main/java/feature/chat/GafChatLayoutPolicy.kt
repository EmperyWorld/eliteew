/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure layout helpers for GAF Chat master-detail panes and scale-aware list/thread sizing.
 *
 * Invariants:
 * - List pane uses proportional weight derived from [MobileDesignTokens.chatListPaneWidthFor], not fixed dp caps on thread.
 *
 * Related:
 * - MOBILE-ANDROID-ADAPTIVE-LAYOUT.md, ChatFeature.kt
 */
package feature.chat

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileWindowWidthClass

data class GafChatMasterDetailPaneWeights(
    val listWeight: Float,
    val threadWeight: Float,
)

data class GafChatListRowLayout(
    val avatarSizeDp: Int,
    val verticalPaddingDp: Int,
    val showQuickActions: Boolean,
    val showPartnerSubtitle: Boolean,
    val titleMaxLines: Int,
    val previewMaxLines: Int,
)

fun resolveGafChatMasterDetailPaneWeights(
    widthClass: MobileWindowWidthClass,
    listPaneWidthDp: Int,
    totalWidthDp: Int,
): GafChatMasterDetailPaneWeights {
    if (totalWidthDp <= 0) {
        return GafChatMasterDetailPaneWeights(listWeight = 0.38f, threadWeight = 0.62f)
    }
    val targetListFraction =
        when (widthClass) {
            MobileWindowWidthClass.Medium -> 0.36f
            MobileWindowWidthClass.Expanded -> 0.34f
            MobileWindowWidthClass.Large,
            MobileWindowWidthClass.ExtraLarge,
            -> 0.32f
            MobileWindowWidthClass.Compact -> 1f
        }
    val widthDerivedFraction = listPaneWidthDp.toFloat() / totalWidthDp.toFloat()
    val listWeight =
        when (widthClass) {
            MobileWindowWidthClass.Compact -> 1f
            else ->
                widthDerivedFraction
                    .coerceIn(0.28f, 0.42f)
                    .let { derived ->
                        ((derived + targetListFraction) / 2f).coerceIn(0.28f, 0.42f)
                    }
        }
    return GafChatMasterDetailPaneWeights(
        listWeight = listWeight,
        threadWeight = 1f,
    )
}

fun resolveGafChatListRowLayout(
    shouldStackChromeActions: Boolean,
    masterDetailListPane: Boolean,
): GafChatListRowLayout {
    val compact = shouldStackChromeActions || masterDetailListPane
    return GafChatListRowLayout(
        avatarSizeDp = if (compact) 40 else 48,
        verticalPaddingDp = if (compact) 8 else 10,
        showQuickActions = !compact,
        showPartnerSubtitle = true,
        titleMaxLines = 1,
        previewMaxLines = 1,
    )
}

fun resolveGafChatBubbleMaxWidthDp(
    threadMaxWidthDp: Int,
    shouldStackChromeActions: Boolean,
): Dp {
    val baseDp =
        when {
            threadMaxWidthDp <= 0 || threadMaxWidthDp == Int.MAX_VALUE -> 320
            else -> threadMaxWidthDp
        }
    val adjusted = if (shouldStackChromeActions) (baseDp * 0.92f).toInt() else baseDp
    return adjusted.coerceIn(240, 720).dp
}

fun resolveGafChatListPaneMinWidthDp(listPaneWidthDp: Int): Dp =
    listPaneWidthDp.coerceAtLeast(260).dp
