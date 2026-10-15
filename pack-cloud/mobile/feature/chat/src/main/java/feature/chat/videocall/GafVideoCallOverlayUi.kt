/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Active GAF Meet WebView session model (join URL, JWT, room metadata).
 *
 * Invariants:
 * - chatId links overlay to chat thread for return bar and post-call refresh.
 *
 * Related:
 * - MainActivity.kt, GafVideoCallCoordinator, GafMeetWebViewLauncher
 */
package feature.chat.videocall

data class GafVideoCallOverlayUi(
    val callId: String,
    val joinUrl: String,
    val meetBaseUrl: String,
    val roomName: String,
    val jwt: String,
    val title: String,
    /** Chat that started the call — used to reopen thread + return bar. */
    val chatId: String? = null,
    val startedAtEpochMs: Long = System.currentTimeMillis(),
)
