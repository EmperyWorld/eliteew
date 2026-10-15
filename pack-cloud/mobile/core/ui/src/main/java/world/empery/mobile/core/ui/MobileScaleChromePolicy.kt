/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central scale/chrome rules for MobileAndroid feature screens (COMPACT/STANDARD/COMFORT + system font).
 *
 * Invariants:
 * - Prefer these helpers over ad-hoc `fontScale >= 1.08f` checks in features.
 * - Touch-target compensation uses layout density factor so COMPACT does not shrink hit areas physically.
 *
 * Related:
 * - MobileUiScale.kt, MobileA11ySupport.kt, MobileScaleChromeLayout.kt, ScaledActionButtons.kt, PremiumGlass.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** When composite font scale is at or above this, stack horizontal chrome rows vertically. */
const val MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD = 1.08f

/** EWDesk / feed collapsed body preview char budgets keyed by [MobileScaleChromePolicy.maxBodyPreviewLines]. */
const val MOBILE_BODY_PREVIEW_CHARS_STACKED = 280
const val MOBILE_BODY_PREVIEW_CHARS_COMFORT = 360
const val MOBILE_BODY_PREVIEW_CHARS_DEFAULT = 480

data class MobileScaleChromePolicy(
    val uiScale: MobileUiScale,
    val compositeFontScale: Float,
) {
    val shouldStackChromeActions: Boolean
        get() = compositeFontScale >= MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD

    val useIconOnlyActions: Boolean
        get() = uiScale.usesIconControls || compositeFontScale >= MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD

    val showSecondarySubtitle: Boolean
        get() = uiScale == MobileUiScale.COMPACT && compositeFontScale < MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD

    val maxHeroTitleLines: Int
        get() = if (shouldStackChromeActions) 1 else 2

    val maxHeroSubtitleLines: Int
        get() = if (shouldStackChromeActions) 0 else if (uiScale == MobileUiScale.COMFORT) 1 else 2

    val maxBodyPreviewLines: Int
        get() =
            when {
                shouldStackChromeActions -> 2
                uiScale == MobileUiScale.COMFORT -> 3
                else -> 4
            }

    /** Card/list titles (feed posts, profile rows) — one line tighter than [maxCardTitleLines] on stack. */
    val maxCardTitleLines: Int
        get() = if (shouldStackChromeActions) 2 else 3

    /** Tool cells, metric captions, compact subtitles under a primary label. */
    val maxCaptionLines: Int
        get() = if (shouldStackChromeActions) 1 else 2

    /** Store rows, hub descriptions, secondary body under a card title. */
    val maxDescriptionLines: Int
        get() = if (shouldStackChromeActions) 2 else 3

    /** Notification row message body — slightly looser than [maxBodyPreviewLines]. */
    val maxNotificationMessageLines: Int
        get() = if (shouldStackChromeActions) 3 else 4

    /** Chat thread previews and AI chat list subtitles. */
    val maxThreadPreviewLines: Int
        get() = if (shouldStackChromeActions) 2 else 3

    /** Metadata rows (tags, source labels) under a card title. */
    val maxMetadataLines: Int
        get() = if (shouldStackChromeActions) 1 else 2

    /** Pin/mute/archive, video-in-bar, metric pills — hide when chrome stacks vertically. */
    val showInlineRowQuickActions: Boolean
        get() = !shouldStackChromeActions

    /** Collapsed markdown/plain preview length for feed-style cards. */
    val bodyPreviewCharBudget: Int
        get() =
            when (maxBodyPreviewLines) {
                2 -> MOBILE_BODY_PREVIEW_CHARS_STACKED
                3 -> MOBILE_BODY_PREVIEW_CHARS_COMFORT
                else -> MOBILE_BODY_PREVIEW_CHARS_DEFAULT
            }

    val useWrappedFilterChips: Boolean
        get() = shouldStackChromeActions || uiScale == MobileUiScale.COMFORT

    /** Compose-space min touch size so physical target stays ~48dp under COMPACT density shrink. */
    val minimumTouchTargetDp: Dp
        get() {
            val factor = uiScale.layoutDensityFactor.coerceIn(0.5f, 1f)
            return (MobileMinimumTouchTargetDp.value / factor).coerceIn(48f, 64f).dp
        }

    val heroTrailingMaxWidthDp: Dp
        get() =
            when {
                shouldStackChromeActions -> 96.dp
                useIconOnlyActions -> 112.dp
                else -> 160.dp
            }
}

fun resolveMobileScaleChromePolicy(
    uiScale: MobileUiScale,
    systemFontScale: Float,
): MobileScaleChromePolicy {
    val composite = uiScale.compositeFontScale(systemFontScale)
    return MobileScaleChromePolicy(uiScale = uiScale, compositeFontScale = composite)
}

@Composable
fun rememberMobileScaleChromePolicy(): MobileScaleChromePolicy {
    val uiScale = LocalMobileUiScale.current
    val fontScale = LocalDensity.current.fontScale
    return remember(uiScale, fontScale) {
        resolveMobileScaleChromePolicy(uiScale, fontScale)
    }
}

@Composable
fun shouldStackChromeActions(): Boolean = rememberMobileScaleChromePolicy().shouldStackChromeActions

@Composable
fun usesScaleAwareIconControls(): Boolean = rememberMobileScaleChromePolicy().useIconOnlyActions
