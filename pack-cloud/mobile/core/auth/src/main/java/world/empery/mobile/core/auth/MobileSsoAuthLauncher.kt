/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Keycloak OIDC login via in-app WebView only; browser/Custom Tabs are not used for
 * MobileAndroid login.
 *
 * Invariants:
 * - PKCE state/code_verifier from [OidcLoginRequest] must not change between launch and callback.
 * - Only HTTPS Keycloak/app hosts in WebView; OAuth callback uses configured redirect URI only.
 *
 * Related:
 * - MobileSsoLaunchPlanner, EmperySsoWebViewActivity, OidcAuthManager, MainActivity
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.content.Intent
import android.util.Log

object MobileSsoAuthLauncher {
    private const val TAG = "MobileSsoAuthLauncher"

    fun planLaunch(
        context: Context,
        oidcAuthManager: OidcAuthManager,
        loginRequest: OidcLoginRequest,
    ): MobileSsoLaunchPlan = MobileSsoLaunchPlanner.planLaunch(context, oidcAuthManager, loginRequest)

    fun createLaunchIntent(
        context: Context,
        loginRequest: OidcLoginRequest,
    ): Intent {
        Log.i(
            TAG,
            "SSO transport=in_app_webview " +
                "quest=${MobileSsoEnvironment.isMetaQuestOrHorizonDevice()}",
        )
        return createInAppWebViewIntent(context, loginRequest)
    }

    fun createInAppWebViewIntent(
        context: Context,
        loginRequest: OidcLoginRequest,
    ): Intent =
        EmperySsoWebViewActivity.createIntent(
            context = context,
            authorizationUrl = loginRequest.authorizationUrl,
            redirectUri = loginRequest.redirectUri,
        )

    /**
     * Shell calls this after [MobileSsoBrowserChoiceHost] returns [MobileSsoBrowserChoiceResult.Selected].
     */
    fun createLaunchIntentAfterBrowserChoice(
        context: Context,
        @Suppress("UNUSED_PARAMETER")
        oidcAuthManager: OidcAuthManager,
        loginRequest: OidcLoginRequest,
        result: MobileSsoBrowserChoiceResult,
    ): Intent? =
        when (result) {
            is MobileSsoBrowserChoiceResult.Selected -> createInAppWebViewIntent(context, loginRequest)
            MobileSsoBrowserChoiceResult.Canceled -> null
        }
}
