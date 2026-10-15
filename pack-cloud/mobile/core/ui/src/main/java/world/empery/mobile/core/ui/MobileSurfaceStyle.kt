/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual surface style for shared mobile UI primitives (glass vs premium vs system).
 *
 * Invariants:
 * - Provided from MainActivity; defaults to SYSTEM when unset.
 *
 * Related:
 * - PremiumGlass.kt, LocalMobileSurfaceStyle.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

enum class MobileSurfaceStyle {
    SYSTEM,
    GLASS,
    PREMIUM,
    ;
}

