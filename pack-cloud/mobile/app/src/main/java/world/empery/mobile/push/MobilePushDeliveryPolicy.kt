/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide which FCM payloads may surface when the local SSO session is missing.
 *
 * Invariants:
 * - Chat/feed/social content stays signed-in only (privacy).
 * - Incoming video-call rings are device alerts (call_id + title); allow when signed out so a
 *   wiped RT after session_replaced does not silently drop ringing while FCM is still registered.
 *
 * Related:
 * - MobileFirebaseMessagingService, MOBILE-ANDROID-PUSH-DEEPLINK-REGISTRY.md
 */
package world.empery.mobile.push

object MobilePushDeliveryPolicy {
    fun isIncomingVideoCallData(data: Map<String, String>): Boolean {
        val type = data["type"]?.trim()?.lowercase().orEmpty()
        val event = data["event"]?.trim()?.lowercase().orEmpty()
        return type == "video_call_incoming" ||
            event == "video_call.incoming" ||
            data.containsKey("call_id") && (type.contains("video") || event.contains("video"))
    }

    fun allowWhenSignedOut(data: Map<String, String>): Boolean = isIncomingVideoCallData(data)
}
