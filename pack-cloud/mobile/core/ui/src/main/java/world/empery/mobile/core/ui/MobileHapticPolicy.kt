/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Centralizes light haptic feedback for primary shell actions.
 *
 * Invariants:
 * - No-op when view is null; uses platform HapticFeedbackConstants only.
 *
 * Related:
 * MainActivity.kt bottom navigation
 */
package world.empery.mobile.core.ui

import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalView

object MobileHapticPolicy {
    fun performTabSelection(view: View?) {
        view?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
    }

    fun performPrimaryAction(view: View?) {
        view?.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
    }

    fun performError(view: View?) {
        view?.performHapticFeedback(HapticFeedbackConstants.REJECT)
    }
}

@Composable
fun rememberHapticView(): View? = LocalView.current
