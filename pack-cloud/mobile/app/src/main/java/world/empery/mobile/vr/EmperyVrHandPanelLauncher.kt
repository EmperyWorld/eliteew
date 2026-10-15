/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * ---
 *
 * Entry points for Quest / MR host apps (e.g. Unity EWORLD3) to open Chat or UGS tabs.
 */
package world.empery.mobile.vr

import android.content.Context
import android.content.Intent
import world.empery.mobile.MainActivity
import world.empery.mobile.MobileDeepLinks

object EmperyVrHandPanelLauncher {
    const val ROUTE_CHAT = "chat"
    const val ROUTE_AI = "ugs"

    fun openChat(context: Context, launchNewTask: Boolean = true) {
        openNavRoute(context, ROUTE_CHAT, launchNewTask)
    }

    fun openAiHub(context: Context, launchNewTask: Boolean = true) {
        openNavRoute(context, ROUTE_AI, launchNewTask)
    }

    fun openNavRoute(context: Context, route: String, launchNewTask: Boolean = true) {
        val normalized = route.trim().lowercase()
        require(MobileDeepLinks.isIncomingTabRoute(normalized)) {
            "Unsupported VR hand panel route: $route"
        }

        val intent =
            Intent(context, MainActivity::class.java).apply {
                putExtra(MobileDeepLinks.EXTRA_NAV_ROUTE, normalized)
                if (launchNewTask) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                }
            }
        context.startActivity(intent)
    }
}
