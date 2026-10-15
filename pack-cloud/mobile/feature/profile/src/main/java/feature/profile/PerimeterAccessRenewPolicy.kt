/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy for when perimeter auto-renewal may run (cooldown, guards).
 *
 * Invariants:
 * - Auto-renew requires explicit user opt-in and active app session.
 *
 * Related:
 * - PerimeterAccessCoordinator, PerimeterAccessPrefs
 */
package feature.profile

import world.empery.mobile.core.network.PerimeterProbeOutcome

object PerimeterAccessRenewPolicy {
    const val COOLDOWN_MS = 15L * 60L * 1000L

    fun canAttemptAutoRenew(
        autoRenewEnabled: Boolean,
        isAuthenticated: Boolean,
        networkValidated: Boolean,
        probeOutcome: PerimeterProbeOutcome,
        lastAttemptMs: Long,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean {
        if (!autoRenewEnabled) return false
        if (!isAuthenticated) return false
        if (!networkValidated) return false
        if (probeOutcome != PerimeterProbeOutcome.Closed) return false
        if (lastAttemptMs > 0L && nowMs - lastAttemptMs < COOLDOWN_MS) return false
        return true
    }

    fun shouldUseNotificationInsteadOfAutoLaunch(appInForeground: Boolean): Boolean = !appInForeground
}
