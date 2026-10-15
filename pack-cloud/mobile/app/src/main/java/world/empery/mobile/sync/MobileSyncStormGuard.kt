/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thread-safe time debounce to suppress overlapping heavy sync / refreshAllTabs after tunnel recovery.
 *
 * Invariants:
 * - lastSyncAttemptEpochMs updated on every markAttempt / successful tryBeginSync.
 * - Default tryBeginSync blocks peers within DEBOUNCE_MS (anti double-fire).
 * - staggeredFollowUp may proceed once after POST_RECOVERY_HEAVY_DELAY_MS even if still inside
 *   DEBOUNCE_MS (CHAT → delay → single heavy wave); a second peer in that wave is still blocked.
 * - Hard cutover / tunnel fail-closed are unaffected.
 *
 * Related:
 * - BackgroundSyncWorker, MobileSyncScheduler, refreshAllTabs, MobilePrivateTunnelRecoveryCoordinator
 */
package world.empery.mobile.sync

import java.util.concurrent.atomic.AtomicLong

object MobileSyncStormGuard {
    const val DEBOUNCE_MS = 15_000L

    /** Post-CONNECTED delay before heavy tab refresh / LIGHT sync (stagger away from CHAT). */
    const val POST_RECOVERY_HEAVY_DELAY_MS = 5_000L

    private val lastSyncAttemptEpochMs = AtomicLong(0L)

    fun lastSyncAttemptEpochMs(): Long = lastSyncAttemptEpochMs.get()

    /**
     * @param staggeredFollowUp when true, allows the first heavy sync after
     *   [POST_RECOVERY_HEAVY_DELAY_MS] even if still inside [DEBOUNCE_MS] (CHAT already marked).
     * @return true if this caller may proceed (timestamp updated).
     */
    fun tryBeginSync(
        staggeredFollowUp: Boolean = false,
        nowEpochMs: Long = System.currentTimeMillis(),
    ): Boolean {
        while (true) {
            val previous = lastSyncAttemptEpochMs.get()
            if (previous > 0L) {
                val elapsed = nowEpochMs - previous
                if (elapsed < DEBOUNCE_MS) {
                    val allowStaggered =
                        staggeredFollowUp && elapsed >= POST_RECOVERY_HEAVY_DELAY_MS
                    if (!allowStaggered) {
                        return false
                    }
                }
            }
            if (lastSyncAttemptEpochMs.compareAndSet(previous, nowEpochMs)) {
                return true
            }
        }
    }

    /** Record any sync attempt (including critical CHAT) without gating. */
    fun markAttempt(nowEpochMs: Long = System.currentTimeMillis()) {
        lastSyncAttemptEpochMs.set(nowEpochMs)
    }

    fun shouldSuppress(
        staggeredFollowUp: Boolean = false,
        nowEpochMs: Long = System.currentTimeMillis(),
    ): Boolean {
        val previous = lastSyncAttemptEpochMs.get()
        if (previous <= 0L) return false
        val elapsed = nowEpochMs - previous
        if (elapsed >= DEBOUNCE_MS) return false
        val allowStaggered = staggeredFollowUp && elapsed >= POST_RECOVERY_HEAVY_DELAY_MS
        return !allowStaggered
    }

    fun isHeavyScope(scope: MobileSyncScope): Boolean =
        when (scope) {
            MobileSyncScope.CHAT -> false
            MobileSyncScope.ALL,
            MobileSyncScope.LIGHT,
            MobileSyncScope.FEED,
            MobileSyncScope.FRIENDS,
            MobileSyncScope.NOTIFICATIONS,
            -> true
        }

    /** Test-only reset. */
    internal fun resetForTests() {
        lastSyncAttemptEpochMs.set(0L)
    }
}
