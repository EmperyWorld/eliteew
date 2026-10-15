/**
 * Native hand-panel embed for MR host apps (Unity EWORLD3).
 * MainActivity runs as a floating window aligned to screen bounds from the host.
 */
package world.empery.mobile.vr

import android.app.Activity
import android.content.Intent
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import world.empery.mobile.MobileDeepLinks

object EmperyHandEmbed {
    private const val LOG_TAG = "EmperyHandEmbed"

    const val EXTRA_HAND_EMBED = "world.empery.mobile.extra.HAND_EMBED"
    const val EXTRA_PANEL_ID = "world.empery.mobile.extra.HAND_EMBED_PANEL_ID"
    const val EXTRA_X = "world.empery.mobile.extra.HAND_EMBED_X"
    const val EXTRA_Y = "world.empery.mobile.extra.HAND_EMBED_Y"
    const val EXTRA_WIDTH = "world.empery.mobile.extra.HAND_EMBED_WIDTH"
    const val EXTRA_HEIGHT = "world.empery.mobile.extra.HAND_EMBED_HEIGHT"

    const val ACTION_UPDATE_BOUNDS = "world.empery.mobile.action.HAND_EMBED_UPDATE_BOUNDS"
    const val ACTION_HIDE = "world.empery.mobile.action.HAND_EMBED_HIDE"

    const val ACTIVITY_CHAT = "world.empery.mobile.vr.EmperyHandEmbedChat"
    const val ACTIVITY_AI = "world.empery.mobile.vr.EmperyHandEmbedAi"

    fun isHandEmbed(intent: Intent?): Boolean =
        intent?.getBooleanExtra(EXTRA_HAND_EMBED, false) == true

    fun panelId(intent: Intent?): String? =
        intent?.getStringExtra(EXTRA_PANEL_ID)?.trim()?.takeIf { it.isNotEmpty() }

    fun buildLaunchIntent(
        activityClass: String,
        panelId: String,
        route: String,
        x: Int,
        y: Int,
        width: Int,
        height: Int,
    ): Intent =
        Intent().apply {
            setClassName("world.empery.mobile", activityClass)
            putExtra(EXTRA_HAND_EMBED, true)
            putExtra(EXTRA_PANEL_ID, panelId)
            putExtra(MobileDeepLinks.EXTRA_NAV_ROUTE, route)
            putExtra(EXTRA_X, x)
            putExtra(EXTRA_Y, y)
            putExtra(EXTRA_WIDTH, width)
            putExtra(EXTRA_HEIGHT, height)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }

    fun applyWindow(activity: Activity, x: Int, y: Int, width: Int, height: Int) {
        if (width < 32 || height < 32) {
            return
        }
        try {
            activity.window.setLayout(width, height)
            val attrs = activity.window.attributes
            attrs.gravity = Gravity.TOP or Gravity.START
            attrs.x = x.coerceAtLeast(0)
            attrs.y = y.coerceAtLeast(0)
            attrs.dimAmount = 0f
            attrs.flags =
                attrs.flags or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            activity.window.attributes = attrs
            Log.i(LOG_TAG, "bounds panel=${panelId(activity.intent)} x=$x y=$y ${width}x$height")
        } catch (t: Throwable) {
            Log.e(LOG_TAG, "applyWindow failed", t)
        }
    }

    fun applyWindowFromIntent(activity: Activity, intent: Intent?) {
        if (intent == null || !isHandEmbed(intent)) {
            return
        }
        applyWindow(
            activity,
            intent.getIntExtra(EXTRA_X, 0),
            intent.getIntExtra(EXTRA_Y, 0),
            intent.getIntExtra(EXTRA_WIDTH, 480),
            intent.getIntExtra(EXTRA_HEIGHT, 640),
        )
    }

    fun shouldHandle(intent: Intent?, panelId: String?): Boolean {
        val target = intent?.getStringExtra(EXTRA_PANEL_ID)?.trim().orEmpty()
        val mine = panelId?.trim().orEmpty()
        return mine.isNotEmpty() && target == mine
    }
}
