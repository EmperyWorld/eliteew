/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hybrid memory/realtime policy constants — background socket grace, chat cache LRU caps.
 *
 * Invariants:
 * - Push + periodic sync remain primary when socket is torn down in background.
 *
 * Related:
 * - MainViewModel, EmperyConnectionService, MobileMemoryTrim.kt
 */
package world.empery.mobile

object MobileMemoryPolicy {
    /** Grace before Socket.IO teardown after app leaves foreground. */
    const val BACKGROUND_REALTIME_DISCONNECT_MS = 45_000L

    /** In-memory chat threads kept after LRU eviction (Room retains history). */
    const val CHAT_MESSAGES_CACHE_MAX_CHATS = 4

    /** Attachment download metadata kept when trimming for background. */
    const val DOWNLOADED_ATTACHMENTS_CACHE_TRIM_TO = 32
}
