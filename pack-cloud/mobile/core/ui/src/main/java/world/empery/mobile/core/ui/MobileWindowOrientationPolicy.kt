/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Activity orientation policy: phones stay portrait; tablets, DeX, and foldables may use full window size and rotation.
 *
 * Invariants:
 * - Phone (`sw < 600`) stays portrait-only.
 * - Quest / Horizon resizable 2D panels use FULL_USER — portrait lock causes FIXED_ORIENTATION letterboxing in wide panels.
 *
 * Related:
 * - MainActivity.kt, AndroidManifest.xml, MOBILE-ANDROID-ADAPTIVE-LAYOUT.md
 */
package world.empery.mobile.core.ui

import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.res.Configuration

object MobileWindowOrientationPolicy {
    fun requestedOrientationFor(
        layout: MobileWindowLayout,
        smallestScreenWidthDp: Int,
    ): Int =
        when {
            layout.profile == MobileLayoutProfile.Phone &&
                smallestScreenWidthDp < TABLET_SMALLEST_WIDTH_DP ->
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        }

    fun apply(
        activity: Activity,
        configuration: Configuration = activity.resources.configuration,
    ) {
        val layout =
            MobileWindowLayout.fromConfiguration(
                configuration,
                activity.packageManager,
            )
        activity.requestedOrientation =
            requestedOrientationFor(layout, configuration.smallestScreenWidthDp)
    }

    private const val TABLET_SMALLEST_WIDTH_DP = 600
}
