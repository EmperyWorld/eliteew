/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reads system reduced-motion preference for Compose animation decisions (a11y-006).
 *
 * Invariants:
 * - Uses ANIMATOR_DURATION_SCALE == 0 as reduce-motion signal.
 * - When reduce motion is on, transitions and springs are disabled (duration 0 / no spring).
 *
 * Related:
 * MainActivity.kt, animate*AsState call sites
 */
package world.empery.mobile.core.ui

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.TweenSpec
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

fun Context.isReduceMotionEnabled(): Boolean =
    try {
        Settings.Global.getFloat(
            contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    } catch (_: Exception) {
        false
    }

@Composable
fun rememberReduceMotionEnabled(): Boolean {
    val context = LocalContext.current
    return remember(context) { context.isReduceMotionEnabled() }
}

fun motionDurationMillis(defaultMs: Int, reduceMotion: Boolean): Int =
    if (reduceMotion) 0 else defaultMs

/** a11y-006: skip float/icon scale animations when reduce motion is enabled. */
fun motionScaleTarget(selected: Boolean, reduceMotion: Boolean): Float =
    when {
        reduceMotion -> 1f
        selected -> 1.12f
        else -> 1f
    }

/** a11y-006: tween spec respecting reduce motion. */
fun <T> motionTweenSpec(defaultMs: Int, reduceMotion: Boolean): AnimationSpec<T> =
    TweenSpec(durationMillis = motionDurationMillis(defaultMs, reduceMotion))

/** a11y-006: spring disabled under reduce motion (instant snap). */
fun <T> motionSpringSpec(reduceMotion: Boolean): AnimationSpec<T> =
    if (reduceMotion) {
        TweenSpec(durationMillis = 0)
    } else {
        SpringSpec()
    }

fun isTransitionEnabled(reduceMotion: Boolean): Boolean = !reduceMotion
