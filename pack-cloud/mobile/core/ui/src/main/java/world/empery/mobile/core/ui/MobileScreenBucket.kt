/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Classify display form factor so large-screen-only UX (extra UI scale) activates on tablets and VR panels.
 *
 * Invariants:
 * - Phone layout must not change when bucket is PHONE; large-screen scale is a separate preference.
 *
 * Related:
 * - MobileLayoutProfile.kt, LocalMobileWindowLayout.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import java.util.Locale
import kotlin.math.max

object MobileScreenBucket {
    fun isLargeScreen(context: Context): Boolean = isLargeScreen(context.resources.configuration)

    fun isLargeScreen(configuration: Configuration): Boolean {
        if (configuration.smallestScreenWidthDp >= TABLET_SMALLEST_WIDTH_DP) return true
        val maxDp = max(configuration.screenWidthDp, configuration.screenHeightDp)
        if (maxDp >= LARGE_PANEL_MAX_EDGE_DP) return true
        return isMetaQuestOrHorizonDevice()
    }

    fun isMetaQuestOrHorizonDevice(): Boolean {
        val manufacturer = Build.MANUFACTURER.orEmpty().lowercase(Locale.US)
        val brand = Build.BRAND.orEmpty().lowercase(Locale.US)
        val model = Build.MODEL.orEmpty().lowercase(Locale.US)
        val device = Build.DEVICE.orEmpty().lowercase(Locale.US)
        if (manufacturer.contains("meta") || manufacturer.contains("oculus")) return true
        if (brand.contains("meta") || brand.contains("oculus")) return true
        if (model.contains("quest") || device.contains("quest")) return true
        return false
    }

    private const val TABLET_SMALLEST_WIDTH_DP = 600
    private const val LARGE_PANEL_MAX_EDGE_DP = 720
}
