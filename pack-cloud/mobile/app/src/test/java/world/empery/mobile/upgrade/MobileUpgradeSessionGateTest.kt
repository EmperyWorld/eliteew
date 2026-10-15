/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JVM tests for [MobileUpgradeSessionGate] await semantics.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - MobileUpgradeSessionGate, MobileAppUpgradeCoordinator
 */
package world.empery.mobile.upgrade

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileUpgradeSessionGateTest {
    @Test
    fun awaitIfScheduled_returnsImmediatelyWhenNotScheduled() {
        val started = System.nanoTime()
        runBlocking {
            MobileUpgradeSessionGate.awaitIfScheduled(timeoutMs = 500L)
        }
        val elapsedMs = (System.nanoTime() - started) / 1_000_000L
        assertTrue(elapsedMs < 200L)
    }
}
