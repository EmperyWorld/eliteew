package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import world.empery.mobile.sync.MobileSyncScope
import world.empery.mobile.sync.MobileSyncStormGuard

class MobileSyncStormGuardTest {
    @Before
    fun reset() {
        MobileSyncStormGuard.resetForTests()
    }

    @Test
    fun tryBeginSync_blocksWithinDebounce() {
        val t0 = 1_000_000L
        assertTrue(MobileSyncStormGuard.tryBeginSync(nowEpochMs = t0))
        assertFalse(MobileSyncStormGuard.tryBeginSync(nowEpochMs = t0 + 1_000L))
        assertTrue(
            MobileSyncStormGuard.tryBeginSync(
                nowEpochMs = t0 + MobileSyncStormGuard.DEBOUNCE_MS,
            ),
        )
    }

    @Test
    fun staggeredFollowUp_allowsOnceAfterPostRecoveryDelay() {
        val t0 = 2_000_000L
        MobileSyncStormGuard.markAttempt(t0)
        assertFalse(
            MobileSyncStormGuard.tryBeginSync(
                staggeredFollowUp = true,
                nowEpochMs = t0 + 1_000L,
            ),
        )
        assertTrue(
            MobileSyncStormGuard.tryBeginSync(
                staggeredFollowUp = true,
                nowEpochMs = t0 + MobileSyncStormGuard.POST_RECOVERY_HEAVY_DELAY_MS,
            ),
        )
        // Second peer in the same heavy wave stays suppressed.
        assertFalse(
            MobileSyncStormGuard.tryBeginSync(
                staggeredFollowUp = true,
                nowEpochMs = t0 + MobileSyncStormGuard.POST_RECOVERY_HEAVY_DELAY_MS + 50L,
            ),
        )
    }

    @Test
    fun shouldSuppress_matchesTryBeginGate() {
        val t0 = 3_000_000L
        MobileSyncStormGuard.markAttempt(t0)
        assertTrue(MobileSyncStormGuard.shouldSuppress(nowEpochMs = t0 + 100L))
        assertFalse(
            MobileSyncStormGuard.shouldSuppress(
                staggeredFollowUp = true,
                nowEpochMs = t0 + MobileSyncStormGuard.POST_RECOVERY_HEAVY_DELAY_MS,
            ),
        )
    }

    @Test
    fun chatIsNotHeavyScope() {
        assertFalse(MobileSyncStormGuard.isHeavyScope(MobileSyncScope.CHAT))
        assertTrue(MobileSyncStormGuard.isHeavyScope(MobileSyncScope.LIGHT))
        assertTrue(MobileSyncStormGuard.isHeavyScope(MobileSyncScope.ALL))
    }

    @Test
    fun markAttempt_updatesTimestamp() {
        MobileSyncStormGuard.markAttempt(42L)
        assertEquals(42L, MobileSyncStormGuard.lastSyncAttemptEpochMs())
    }
}
