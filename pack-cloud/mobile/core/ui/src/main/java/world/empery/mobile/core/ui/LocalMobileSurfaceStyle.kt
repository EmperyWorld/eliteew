/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CompositionLocal for active [MobileSurfaceStyle] inside the mobile shell tree.
 *
 * Invariants:
 * - Provided from MainActivity together with [LocalMobileUiScale].
 *
 * Related:
 * - PremiumGlass.kt, MobileSurfaceStyle.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.compositionLocalOf

val LocalMobileSurfaceStyle = compositionLocalOf { MobileSurfaceStyle.SYSTEM }

