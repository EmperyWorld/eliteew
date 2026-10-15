/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for proactive access-token expiry skew detection.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - AuthRepository, ProactiveTokenRefreshInterceptor
 */
package world.empery.mobile.core.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthTokenExpiryTest {
    @Test
    fun expiringWithin_skew_whenLessThanSixtySecondsRemaining() {
        val now = System.currentTimeMillis() / 1000L
        assertTrue(isExpiringWithin(now + 30L, now, AuthRepository.DEFAULT_EXPIRY_SKEW_SECONDS))
    }

    @Test
    fun notExpiringWithin_whenMoreThanSkewRemaining() {
        val now = System.currentTimeMillis() / 1000L
        assertFalse(isExpiringWithin(now + 300L, now, AuthRepository.DEFAULT_EXPIRY_SKEW_SECONDS))
    }

    private fun isExpiringWithin(expiresAt: Long, now: Long, skewSeconds: Long): Boolean =
        expiresAt <= now + skewSeconds
}
