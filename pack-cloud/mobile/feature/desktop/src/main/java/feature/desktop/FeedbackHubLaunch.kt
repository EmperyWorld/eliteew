// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop Feedback Hub embedded SPA from MobileAndroid.
// Related:
// - FeedbackHubWebViewLauncher.kt, MobileFeedbackHubPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias FeedbackHubLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object FeedbackHubLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): FeedbackHubLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.feedbackHub,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_feedback_hub_tunnel_required,
            sessionRequiredRes = R.string.desktop_feedback_hub_session_required,
        )
}
