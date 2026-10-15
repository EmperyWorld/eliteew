/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile-facing labels and SharedPreferences persistence for [world.empery.mobile.core.ui.MobileUiScale].
 *
 * Invariants:
 * - Canonical enum lives in core:ui; this module owns user-facing chip strings only.
 *
 * Related:
 * - world.empery.mobile.core.ui.MobileUiScale, MainActivity.kt
 */
package feature.profile

import android.content.Context
import androidx.annotation.StringRes
import world.empery.mobile.core.ui.MobileUiScale as CoreMobileUiScale

typealias MobileUiScale = CoreMobileUiScale


val CoreMobileUiScale.chipLabelRes: Int
    @StringRes
    get() =
        when (this) {
            MobileUiScale.COMPACT -> R.string.profile_scale_chip_compact
            MobileUiScale.STANDARD -> R.string.profile_scale_chip_standard
            MobileUiScale.COMFORT -> R.string.profile_scale_chip_comfort
        }

val CoreMobileUiScale.chipDescriptionRes: Int
    @StringRes
    get() =
        when (this) {
            MobileUiScale.COMPACT -> R.string.profile_scale_desc_compact
            MobileUiScale.STANDARD -> R.string.profile_scale_desc_standard
            MobileUiScale.COMFORT -> R.string.profile_scale_desc_comfort
        }

object MobileUiScalePreferences {
    private const val PREFS = "empery_mobile_ui"
    private const val KEY_SCALE = "mobile_ui_scale"

    fun get(context: Context): CoreMobileUiScale {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return MobileUiScale.fromStorage(p.getString(KEY_SCALE, null))
    }

    fun set(context: Context, scale: CoreMobileUiScale) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SCALE, MobileUiScale.toStorage(scale))
            .apply()
    }
}
