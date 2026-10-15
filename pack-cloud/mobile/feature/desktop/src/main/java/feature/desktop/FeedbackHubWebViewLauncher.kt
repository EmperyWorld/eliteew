// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with desktop Feedback Hub SPA (`#/mobile-feedback-hub`).
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileFeedbackHubPage.tsx
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

object FeedbackHubWebViewLauncher {
    const val MOBILE_FEEDBACK_HUB_HASH: String = "mobile-feedback-hub"

    fun feedbackHubSpaUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(webOrigin, MOBILE_FEEDBACK_HUB_HASH)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.feedbackHub,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
    }

    fun buildIntent(
        context: Context,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ): Intent =
        MobileEmbeddedSpaWebViewLauncher.buildIntent(
            context = context,
            spec = MobileEmbeddedSpaSpecs.feedbackHub,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
}
