/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy shell callback contract for browser picker. MobileAndroid login is WebView-only; these
 * types remain for compatibility with old shell wiring and tests.
 *
 * Invariants:
 * - If legacy picker wiring is reached, it must not replace the PKCE loginRequest.
 *
 * Related:
 * - MobileSsoLaunchPlanner, MainActivity (shell wiring)
 */
package world.empery.mobile.core.auth

/**
 * Legacy app-shell browser picker callback. Production login should not request this path.
 */
fun interface MobileSsoBrowserChoiceHost {
    fun showBrowserChoice(
        request: MobileSsoBrowserChoiceRequest,
        onResult: (MobileSsoBrowserChoiceResult) -> Unit,
    )
}

data class MobileSsoBrowserChoiceRequest(
    val loginRequest: OidcLoginRequest,
    val options: List<MobileSsoBrowserOption>,
)

sealed class MobileSsoBrowserChoiceResult {
    data class Selected(val packageName: String) : MobileSsoBrowserChoiceResult()

    data object Canceled : MobileSsoBrowserChoiceResult()
}

sealed class MobileSsoLaunchPlan {
    /** Primary MobileAndroid login transport — in-app WebView activity. */
    data class InAppWebView(val intent: android.content.Intent) : MobileSsoLaunchPlan()

    /** Legacy AppAuth Custom Tabs path; production login planner must not return this. */
    data class DirectAppAuth(val intent: android.content.Intent) : MobileSsoLaunchPlan()

    /** Legacy browser picker path; production login planner must not return this. */
    data class ChooseBrowser(val request: MobileSsoBrowserChoiceRequest) : MobileSsoLaunchPlan()
}
