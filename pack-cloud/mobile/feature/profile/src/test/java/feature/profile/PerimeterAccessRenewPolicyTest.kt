/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for perimeter auto-renew policy guards and cooldown.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - PerimeterAccessRenewPolicy.kt
 */
package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.PerimeterProbeOutcome

class PerimeterAccessRenewPolicyTest {
    @Test
    fun canAttemptAutoRenew_requiresOptInAndClosedPerimeter() {
        assertFalse(
            PerimeterAccessRenewPolicy.canAttemptAutoRenew(
                autoRenewEnabled = false,
                isAuthenticated = true,
                networkValidated = true,
                probeOutcome = PerimeterProbeOutcome.Closed,
                lastAttemptMs = 0L,
            ),
        )
        assertTrue(
            PerimeterAccessRenewPolicy.canAttemptAutoRenew(
                autoRenewEnabled = true,
                isAuthenticated = true,
                networkValidated = true,
                probeOutcome = PerimeterProbeOutcome.Closed,
                lastAttemptMs = 0L,
            ),
        )
        assertFalse(
            PerimeterAccessRenewPolicy.canAttemptAutoRenew(
                autoRenewEnabled = true,
                isAuthenticated = true,
                networkValidated = true,
                probeOutcome = PerimeterProbeOutcome.Open,
                lastAttemptMs = 0L,
            ),
        )
    }

    @Test
    fun canAttemptAutoRenew_respectsCooldown() {
        val now = 1_000_000L
        assertFalse(
            PerimeterAccessRenewPolicy.canAttemptAutoRenew(
                autoRenewEnabled = true,
                isAuthenticated = true,
                networkValidated = true,
                probeOutcome = PerimeterProbeOutcome.Closed,
                lastAttemptMs = now - 60_000L,
                nowMs = now,
            ),
        )
    }
}
