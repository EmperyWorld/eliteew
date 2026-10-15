/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CompositionLocal for active [MobileUiScale] preset inside the mobile shell tree.
 *
 * Invariants:
 * - Provided from MainActivity together with scaled LocalDensity.
 *
 * Related:
 * - ScaledActionButtons.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.compositionLocalOf

val LocalMobileUiScale = compositionLocalOf { MobileUiScale.COMPACT }
