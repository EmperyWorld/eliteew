/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build OidcAuthManager with AppAuth (Chrome Custom Tabs by default) for in-app Keycloak login.
 *
 * Invariants:
 * - Quest uses in-app WebView; phones use AppAuth Custom Tabs with optional browser binding.
 *
 * Related:
 * - OidcAuthManager, AppContainer, MainViewModel
 */
package world.empery.mobile.core.auth

import android.content.Context
import net.openid.appauth.AuthorizationService

object MobileSsoAuthFactory {
    fun create(context: Context, config: MobileOidcRuntimeConfig): OidcAuthManager {
        val appContext = context.applicationContext
        val authorizationService = AuthorizationService(appContext)
        return OidcAuthManager(
            appContext = appContext,
            authorizationService = authorizationService,
            authorizationEndpoint = config.authorizationEndpoint,
            tokenEndpoint = config.tokenEndpoint,
            clientId = config.clientId,
            redirectUri = config.redirectUri,
        )
    }
}
