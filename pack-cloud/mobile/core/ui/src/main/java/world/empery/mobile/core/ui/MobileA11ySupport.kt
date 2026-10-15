/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap a11y-002…004: contrast audit notes, font-scale stress helpers, keyboard focus order.
 *
 * Invariants:
 * - Font stress applies only when explicitly enabled via shell prefs (debug/QA).
 * - Contrast notes are documentation constants; they do not mutate theme colors at runtime.
 *
 * Related:
 * - MobileMotionPolicy.kt, MobileShellRoadmapSupport.kt, MainActivity.kt, MobileScaleChromePolicy.kt
 */
package world.empery.mobile.core.ui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** a11y-002: documented contrast pairs for shell QA (WCAG 2.1 AA target ≥ 4.5:1 body, 3:1 large). */
object MobileA11yContrastNotes {
    const val NOTE_BOTTOM_NAV_SELECTED =
        "Bottom nav selected icon/text: primary on primaryContainer (~4.8:1 in default Material3 light)."
    const val NOTE_BOTTOM_NAV_UNSELECTED =
        "Bottom nav unselected: onSurfaceVariant on surface (~4.6:1 light, ~5.2:1 dark)."
    const val NOTE_OFFLINE_BANNER =
        "Offline banner: onErrorContainer on errorContainer (~7:1)."
    const val NOTE_GLASS_CARD_BODY =
        "Premium glass cards: onSurface on surfaceContainerLow; verify with dynamic wallpaper alpha."
}

const val MOBILE_COMPOSITE_FONT_SCALE_MIN = 0.85f
const val MOBILE_COMPOSITE_FONT_SCALE_MAX = 1.35f

fun clampCompositeFontScale(raw: Float): Float =
    raw.coerceIn(MOBILE_COMPOSITE_FONT_SCALE_MIN, MOBILE_COMPOSITE_FONT_SCALE_MAX)

/** System font scale × app UI scale preset, bounded to keep layouts stable. */
fun MobileUiScale.compositeFontScale(systemFontScale: Float): Float =
    clampCompositeFontScale(systemFontScale * textFontScaleFactor)

/** a11y-003: optional font-scale stress multiplier (1.0 = system, up to 1.6 for layout QA). */
fun fontScaleStressMultiplier(context: Context, shellStressEnabled: Boolean): Float {
    if (!shellStressEnabled) return 1f
    return 1.35f
}

@Composable
fun rememberEffectiveFontScale(shellStressEnabled: Boolean): Float {
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    return remember(configuration.fontScale, shellStressEnabled) {
        configuration.fontScale * fontScaleStressMultiplier(context, shellStressEnabled)
    }
}

fun scaleSpForStress(baseSp: Float, effectiveFontScale: Float, systemFontScale: Float): TextUnit {
    if (systemFontScale <= 0f) return baseSp.sp
    val adjusted = baseSp * (effectiveFontScale / systemFontScale)
    return adjusted.coerceIn(10f, 40f).sp
}

fun scaleDpForStress(baseDp: Dp, effectiveFontScale: Float, systemFontScale: Float): Dp {
    if (systemFontScale <= 0f) return baseDp
    val ratio = (effectiveFontScale / systemFontScale).coerceIn(1f, 1.25f)
    return (baseDp.value * ratio).dp
}

/** a11y-004: bottom-tab focus traversal order (left-to-right). */
val BOTTOM_NAV_FOCUS_ORDER: List<String> =
    listOf("feed", "chat", "ugs", "friends", "profile")

fun bottomNavFocusIndex(route: String): Int =
    BOTTOM_NAV_FOCUS_ORDER.indexOf(route.trim().lowercase()).coerceAtLeast(0)

/** Non-compose check: preset × system font crosses chrome stack threshold. */
fun shouldStackMobileChrome(
    uiScale: MobileUiScale,
    systemFontScale: Float,
): Boolean = resolveMobileScaleChromePolicy(uiScale, systemFontScale).shouldStackChromeActions

fun exceedsMobileChromeStackThreshold(compositeFontScale: Float): Boolean =
    compositeFontScale >= MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD
