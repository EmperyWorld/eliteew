/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Choose SSO transport for MobileAndroid login. The native app uses in-app WebView for
 * Keycloak so login cookies stay scoped to the app instead of the external browser profile.
 *
 * Invariants:
 * - MobileAndroid login must not launch external browser or Custom Tabs for OIDC.
 *
 * Related:
 * - MobileSsoAuthLauncher, EmperySsoWebViewActivity
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.os.Build
import java.util.Locale

object MobileSsoEnvironment {
    @Suppress("UNUSED_PARAMETER")
    fun useInAppWebView(context: Context): Boolean = true

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
}
