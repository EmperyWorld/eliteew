// ---
// EliteEW · Empery World
// https://eliteew.ru
// Author: po&T <keysray70@gmail.com>
// ---
// Purpose:
// Launch GAF video calls in an in-app WebView using the backend `join_url`, matching desktop
// VideoCallApp iframe behavior instead of the native Jitsi Meet SDK.
// Invariants:
// - Only HTTPS URLs on `*.eliteew.ru` hosts are accepted.
// - `requestFinish` is used when the app ends a call programmatically (no user-left broadcast).
// Related:
// - EmperyMeetWebViewActivity.kt, MainActivity.kt, MainViewModel.kt
// ---
package feature.chat

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.net.URI

/** Opens [EmperyMeetWebViewActivity] with a trusted Meet `join_url`. */
object GafMeetWebViewLauncher {
    const val EXTRA_JOIN_URL: String = "world.empery.mobile.extra.GAF_MEET_JOIN_URL"
    const val EXTRA_TITLE: String = "world.empery.mobile.extra.GAF_MEET_TITLE"
    const val EXTRA_CALL_ID: String = "world.empery.mobile.extra.GAF_MEET_CALL_ID"
    const val EXTRA_CHAT_ID: String = "world.empery.mobile.extra.GAF_MEET_CHAT_ID"
    const val EXTRA_DURATION_SECONDS: String = "world.empery.mobile.extra.GAF_MEET_DURATION_SECONDS"

    const val ACTION_FINISH_GAF_MEET: String = "world.empery.mobile.action.FINISH_GAF_MEET"
    const val ACTION_GAF_MEET_USER_LEFT: String = "world.empery.mobile.action.GAF_MEET_USER_LEFT"
    const val ACTION_GAF_MEET_CALL_ENDED: String = "world.empery.mobile.action.GAF_MEET_CALL_ENDED"

    fun isValidJoinUrl(raw: String): Boolean {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return false
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return false
        if (uri.scheme?.lowercase() != "https") return false
        if (!isTrustedEmperyHost(uri.host)) return false
        val path = uri.path?.trim('/')?.takeIf { it.isNotBlank() }
        val hasJwtQuery = uri.query?.contains("jwt=", ignoreCase = true) == true
        return path != null || hasJwtQuery
    }

    fun isTrustedEmperyHost(host: String?): Boolean =
        host == "eliteew.ru" || host?.endsWith(".eliteew.ru") == true

    fun launch(
        activity: Activity,
        joinUrl: String,
        title: String?,
        callId: String,
        chatId: String? = null,
    ) {
        if (!isValidJoinUrl(joinUrl)) return
        activity.startActivity(
            buildIntent(activity, joinUrl, title, callId, chatId).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
    }

    /** Brings an existing meet WebView activity to the foreground without reloading the room. */
    fun bringToForeground(
        activity: Activity,
        joinUrl: String,
        title: String?,
        callId: String,
        chatId: String? = null,
    ) {
        if (!isValidJoinUrl(joinUrl)) return
        activity.startActivity(
            buildIntent(activity, joinUrl, title, callId, chatId).apply {
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
    }

    fun requestFinish(
        context: Context,
        callId: String? = null,
    ) {
        LocalBroadcastManager.getInstance(context).sendBroadcast(
            Intent(ACTION_FINISH_GAF_MEET).apply {
                callId?.let { putExtra(EXTRA_CALL_ID, it) }
            },
        )
    }

    private fun buildIntent(
        context: Context,
        joinUrl: String,
        title: String?,
        callId: String,
        chatId: String? = null,
    ): Intent =
        Intent(context, EmperyMeetWebViewActivity::class.java).apply {
            putExtra(EXTRA_JOIN_URL, joinUrl.trim())
            putExtra(EXTRA_CALL_ID, callId)
            chatId?.trim()?.takeIf { it.isNotEmpty() }?.let { putExtra(EXTRA_CHAT_ID, it) }
            title?.trim()?.takeIf { it.isNotEmpty() }?.let { putExtra(EXTRA_TITLE, it) }
        }
}
