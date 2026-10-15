// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Shared launch gate for embedded SPA WebViews (tunnel + SSO session + trusted origin).
// Invariants:
// - Requires trusted-device VPN when private tunnel bootstrap is blocked.
// Related:
// - MobileEmbeddedSpaWebViewLauncher.kt, EwaCompanionLaunch.kt, HandbookLaunch.kt
// ---
package feature.desktop

import android.app.Activity
import android.widget.Toast
import androidx.activity.ComponentActivity

enum class MobileEmbeddedSpaLaunchOutcome {
    Launched,
    TunnelRequired,
    SessionRequired,
    InvalidOrigin,
    UnknownRoute,
}

object MobileEmbeddedSpaLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        spec: MobileEmbeddedSpaSpec,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
        tunnelRequiredRes: Int,
        sessionRequiredRes: Int,
        hashQuery: String? = null,
    ): MobileEmbeddedSpaLaunchOutcome {
        if (privateTunnelBootstrapBlocked) {
            Toast
                .makeText(activity, activity.getString(tunnelRequiredRes), Toast.LENGTH_LONG)
                .show()
            return MobileEmbeddedSpaLaunchOutcome.TunnelRequired
        }
        val access = accessToken?.trim().orEmpty()
        val refresh = refreshToken?.trim().orEmpty()
        if (access.isBlank() || refresh.isBlank()) {
            Toast
                .makeText(activity, activity.getString(sessionRequiredRes), Toast.LENGTH_LONG)
                .show()
            return MobileEmbeddedSpaLaunchOutcome.SessionRequired
        }
        if (!MobileEmbeddedSpaWebViewLauncher.isValidWebOrigin(webOrigin)) {
            return MobileEmbeddedSpaLaunchOutcome.InvalidOrigin
        }
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = spec,
            webOrigin = webOrigin,
            accessToken = access,
            refreshToken = refresh,
            hashQuery = hashQuery,
        )
        return MobileEmbeddedSpaLaunchOutcome.Launched
    }
}
