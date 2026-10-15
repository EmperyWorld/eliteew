/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop store catalog helpers: removable install rows and badge labels.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubLogic.kt
 */
package feature.desktop

import world.empery.mobile.core.network.api.DesktopStoreAppDto

/** Mirrors web AppStore: system/factory catalog rows cannot be uninstalled. */
fun DesktopStoreAppDto.isRemovableFromDesktop(): Boolean {
    if (can_uninstall == false) return false
    if (is_system == true || is_factory == true) return false
    return true
}

fun DesktopStoreAppDto.storeBadgeLabelRes(): Int? =
    when {
        is_factory == true -> R.string.desktop_store_badge_factory
        is_system == true -> R.string.desktop_store_badge_system
        can_uninstall == false -> R.string.desktop_store_badge_builtin
        else -> null
    }
