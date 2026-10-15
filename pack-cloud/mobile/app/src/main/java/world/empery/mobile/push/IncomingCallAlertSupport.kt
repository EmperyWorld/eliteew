/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Incoming-call alert helpers: suppress misleading chat notifications and show lock-screen ring UX.
 *
 * Invariants:
 * - video_call_event chat rows never spawn a generic chat notification.
 * - Incoming call alerts use NotificationHelper (ringtone FGS + full-screen intent).
 *
 * Related:
 * - MainViewModel.kt, NotificationHelper.kt, mobile_push_service.py
 */
package world.empery.mobile.push

import android.content.Context
import org.json.JSONObject

object IncomingCallAlertSupport {
    fun isVideoCallEventMessage(payload: JSONObject): Boolean {
        val metadata = payload.optJSONObject("metadata") ?: return false
        return metadata.optString("kind").trim() == "video_call_event"
    }

    fun shouldSuppressChatNotification(payload: JSONObject): Boolean {
        if (isVideoCallEventMessage(payload)) return true
        return payload.optBoolean("recipient_is_muted") && isVideoCallSystemBody(payload.optString("body"))
    }

    fun shouldSuppressChatNotificationData(data: Map<String, String>): Boolean {
        val kind = data["metadata_kind"]?.trim().orEmpty()
        if (kind == "video_call_event") return true
        return isVideoCallSystemBody(data["body"]?.trim().orEmpty())
    }

    fun showIncomingCallAlert(
        context: Context,
        callId: String,
        chatId: String?,
        title: String,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
        callKind: String? = null,
    ) {
        if (callId.isBlank()) return
        NotificationHelper.showIncomingVideoCall(
            context = context.applicationContext,
            callId = callId,
            chatId = chatId,
            title = title,
            callerUserId = callerUserId,
            callerAvatarUrl = callerAvatarUrl,
            callKind = callKind,
        )
    }

    private fun isVideoCallSystemBody(body: String?): Boolean {
        val normalized = body?.trim().orEmpty()
        if (normalized.isEmpty()) return false
        return normalized in VIDEO_CALL_EVENT_PUSH_BODIES
    }

    private val VIDEO_CALL_EVENT_PUSH_BODIES =
        setOf(
            "Видеозвонок начат",
            "Видеозвонок принят",
            "Видеозвонок завершён",
            "Видеозвонок пропущен",
            "Video call started",
            "Video call accepted",
            "Video call ended",
            "Video call missed",
        )
}
