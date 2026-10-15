/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scale-aware layout metrics for Empery media player chrome (dock + expanded sheet).
 *
 * Invariants:
 * - Delegates stacking/icon-only/touch-target rules to [MobileScaleChromePolicy]; no ad-hoc fontScale checks.
 * - Pure [resolveEmperyPlayerChromeMetrics] is unit-tested; composables call [rememberEmperyPlayerChromeMetrics].
 *
 * Related:
 * - EmperyPlayerChrome.kt, EmperyMediaPlayerUi.kt, EmperyExpandedPlayerSheet.kt
 * - documentation/product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md
 * - documentation/product/desktop/ELITEEW-AUDIO-PLAYER-AND-MUSIC-UI-FULL-SUMMARY-2026-05-31.md
 */
package world.empery.mobile.core.media

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileScaleChromePolicy
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import world.empery.mobile.core.ui.resolveMobileScaleChromePolicy

data class EmperyPlayerChromeMetrics(
    val chrome: MobileScaleChromePolicy,
    val shouldStackChromeActions: Boolean,
    val useIconOnlyToolChips: Boolean,
    val showDockSwipeHint: Boolean,
    val showDockSubtitle: Boolean,
    val showDockTimeLabel: Boolean,
    val dockTitleMaxLines: Int,
    val dockSubtitleMaxLines: Int,
    val expandedTitleMaxLines: Int,
    val expandedSubtitleMaxLines: Int,
    val dockArtworkSize: Dp,
    val dockPlayButtonSize: Dp,
    val dockPlayIconSize: Dp,
    val miniPlayButtonSize: Dp,
    val primaryPlayButtonSize: Dp,
    val primaryPlayIconSize: Dp,
    val primaryPlayLoadingSize: Dp,
    val transportIconSize: Dp,
    val skipTransportIconSize: Dp,
    val minimumTouchTarget: Dp,
    val expandedArtworkSize: Dp,
    val expandedHeroHeight: Dp,
    val progressStripHeight: Dp,
    val toolChipFullWidth: Boolean,
)

fun resolveEmperyPlayerChromeMetrics(
    chrome: MobileScaleChromePolicy,
    hasQueueOrFavorites: Boolean = false,
): EmperyPlayerChromeMetrics {
    val stack = chrome.shouldStackChromeActions
    val compact = chrome.uiScale == MobileUiScale.COMPACT
    val minTouch = chrome.minimumTouchTargetDp

    val dockArtwork =
        when {
            stack -> 40.dp
            compact -> 44.dp
            else -> 48.dp
        }
    val dockPlay =
        when {
            stack -> minTouch.coerceAtMost(44.dp)
            else -> minTouch.coerceAtMost(48.dp)
        }
    val primaryPlay =
        when {
            stack -> 56.dp
            compact -> 60.dp
            else -> 64.dp
        }

    val expandedArtwork =
        when {
            stack ->
                if (hasQueueOrFavorites) {
                    140.dp
                } else {
                    160.dp
                }
            hasQueueOrFavorites -> 168.dp
            else -> 196.dp
        }
    val expandedHero =
        when {
            stack ->
                if (hasQueueOrFavorites) {
                    160.dp
                } else {
                    200.dp
                }
            hasQueueOrFavorites -> 200.dp
            else -> 260.dp
        }

    return EmperyPlayerChromeMetrics(
        chrome = chrome,
        shouldStackChromeActions = stack,
        useIconOnlyToolChips = chrome.useIconOnlyActions,
        showDockSwipeHint = !stack,
        showDockSubtitle = !stack && chrome.maxHeroSubtitleLines > 0,
        showDockTimeLabel = true,
        dockTitleMaxLines = chrome.maxHeroTitleLines,
        dockSubtitleMaxLines = if (stack) 0 else 1,
        expandedTitleMaxLines = if (stack) 2 else 2,
        expandedSubtitleMaxLines = chrome.maxHeroSubtitleLines,
        dockArtworkSize = dockArtwork,
        dockPlayButtonSize = dockPlay,
        dockPlayIconSize = if (stack) 28.dp else 32.dp,
        miniPlayButtonSize = dockPlay,
        primaryPlayButtonSize = primaryPlay,
        primaryPlayIconSize = if (stack) 30.dp else 34.dp,
        primaryPlayLoadingSize = if (stack) 24.dp else 28.dp,
        transportIconSize = 24.dp,
        skipTransportIconSize = if (stack) 26.dp else 28.dp,
        minimumTouchTarget = minTouch,
        expandedArtworkSize = expandedArtwork,
        expandedHeroHeight = expandedHero,
        progressStripHeight = if (stack) 3.dp else 4.dp,
        toolChipFullWidth = stack || chrome.useWrappedFilterChips,
    )
}

@Composable
fun rememberEmperyPlayerChromeMetrics(hasQueueOrFavorites: Boolean = false): EmperyPlayerChromeMetrics {
    val chrome = rememberMobileScaleChromePolicy()
    return remember(chrome, hasQueueOrFavorites) {
        resolveEmperyPlayerChromeMetrics(chrome, hasQueueOrFavorites)
    }
}
