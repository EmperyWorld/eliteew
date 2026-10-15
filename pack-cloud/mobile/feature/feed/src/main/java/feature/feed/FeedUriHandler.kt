/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified EWDesk feed UriHandler: internal desktop-open links → mobile shell store app ids.
 *
 * Invariants:
 * - Only `/__eliteew-desktop-open-app__/` paths are intercepted; external URLs delegate to the platform handler.
 *
 * Related:
 * - FeedInternalLinkRouting.kt, MobileInstalledAppRoutes.kt, FeedFeature.kt
 */
package feature.feed

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler

/** Resolve EWDesk markdown desktop-open URI to a store `app_id` understood by [world.empery.mobile.core.ui.MobileInstalledAppRoutes]. */
internal fun resolveFeedOpenAppStoreId(uri: String): String? =
    parseFeedInternalAppLink(uri)?.toStoreAppIdForMobileShell()

@Composable
internal fun rememberFeedUriHandler(onOpenApp: (String) -> Unit): UriHandler {
    val default = LocalUriHandler.current
    return remember(onOpenApp, default) {
        object : UriHandler {
            override fun openUri(uri: String) {
                resolveFeedOpenAppStoreId(uri)?.let { storeAppId ->
                    onOpenApp(storeAppId)
                    return
                }
                runCatching { default.openUri(uri) }
            }
        }
    }
}
