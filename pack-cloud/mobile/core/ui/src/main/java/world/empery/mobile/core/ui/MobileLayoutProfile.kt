/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overlay form-factor profile on top of width class (Quest VR panel vs phone vs tablet vs foldable).
 *
 * Invariants:
 * - VrPanel keeps bottom navigation even when width is below rail threshold.
 * - FoldableInner uses wide column rules when unfolded but bottom bar when current width is under 600dp.
 *
 * Related:
 * - MobileScreenBucket.kt, MobileWindowWidthClass.kt, LocalMobileWindowLayout.kt
 */
package world.empery.mobile.core.ui

import android.content.pm.PackageManager
import android.content.res.Configuration

enum class MobileLayoutProfile {
    Phone,
    Tablet,
    VrPanel,
    FoldableInner,
    ;

    val prefersBottomNavigation: Boolean
        get() = this == Phone || this == VrPanel

    val prefersTwoColumnCards: Boolean
        get() = this == VrPanel || this == Tablet || this == FoldableInner

    companion object {
        fun resolve(
            configuration: Configuration,
            packageManager: PackageManager? = null,
        ): MobileLayoutProfile {
            if (MobileScreenBucket.isMetaQuestOrHorizonDevice()) {
                return VrPanel
            }
            if (
                packageManager != null &&
                isFoldableFromPackageManager(packageManager) &&
                configuration.smallestScreenWidthDp >= TABLET_SMALLEST_WIDTH_DP
            ) {
                return FoldableInner
            }
            return if (configuration.smallestScreenWidthDp >= TABLET_SMALLEST_WIDTH_DP) {
                Tablet
            } else {
                Phone
            }
        }

        fun isFoldableFromPackageManager(packageManager: PackageManager): Boolean {
            if (packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_HINGE_ANGLE)) return true
            return packageManager.hasSystemFeature("android.hardware.sensor.hinge_angle")
        }

        private const val TABLET_SMALLEST_WIDTH_DP = 600
    }
}
