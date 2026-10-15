/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy for Seamless Tunnel Recovery — hard HTTP cutover, orchestrated resume,
 * authenticated auto-heal, and shell UX.
 *
 * Invariants:
 * - Hard cutover when leaving CONNECTED or entering RETRYING (zombie socket prevention).
 * - Orchestrated resume only on transition into CONNECTED (idempotent flush trigger).
 * - Background sync tunnel defer uses bounded retry, not silent success-skip.
 * - Auto-heal retries DISCONNECTED/ERROR when config is present; never loops on
 *   PERMISSION_REQUIRED / VPN_CONFLICT / NOT_CONFIGURED (user or setup gate).
 *
 * Related:
 * - MobilePrivateTunnelManager, AppContainer, BackgroundSyncWorker, TunnelShellBridge
 */
package world.empery.mobile.tunnel

object MobilePrivateTunnelRecoveryPolicy {
    /** WorkManager runAttemptCount at/above this stops retrying tunnel-defer (CONNECTED flush recovers). */
    const val MAX_BACKGROUND_SYNC_TUNNEL_DEFER_ATTEMPTS = 8

    /** Observe window after a start request before another auto-heal cycle. */
    const val AUTO_HEAL_OBSERVE_MS = 8_000L

    /** Cap between auto-heal start requests while stuck in ERROR/DISCONNECTED. */
    const val AUTO_HEAL_MAX_BACKOFF_MS = 60_000L

    fun shouldHardCutoverSessionHttp(
        previous: MobilePrivateTunnelStatus,
        next: MobilePrivateTunnelStatus,
    ): Boolean {
        if (next == MobilePrivateTunnelStatus.RETRYING) return true
        return previous == MobilePrivateTunnelStatus.CONNECTED && next != MobilePrivateTunnelStatus.CONNECTED
    }

    fun shouldOrchestratedResume(
        previous: MobilePrivateTunnelStatus,
        next: MobilePrivateTunnelStatus,
    ): Boolean = previous != MobilePrivateTunnelStatus.CONNECTED && next == MobilePrivateTunnelStatus.CONNECTED

    /**
     * Shell should request [MobilePrivateTunnelManager.start] again — config present,
     * private mode, tunnel idle/failed (not already bringing up / waiting on user consent).
     */
    fun shouldAutoHealPrivateTunnel(
        privateTunnelRuntimeMode: Boolean,
        configImported: Boolean,
        status: MobilePrivateTunnelStatus,
        shellAutoHealSuppressed: Boolean = false,
    ): Boolean {
        if (!privateTunnelRuntimeMode || !configImported || shellAutoHealSuppressed) return false
        return when (status) {
            MobilePrivateTunnelStatus.DISCONNECTED,
            MobilePrivateTunnelStatus.ERROR,
            -> true
            MobilePrivateTunnelStatus.NOT_CONFIGURED,
            MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
            MobilePrivateTunnelStatus.VPN_CONFLICT,
            MobilePrivateTunnelStatus.CONNECTING,
            MobilePrivateTunnelStatus.WAITING_EDGE,
            MobilePrivateTunnelStatus.RETRYING,
            MobilePrivateTunnelStatus.CONNECTED,
            MobilePrivateTunnelStatus.STOPPING,
            -> false
        }
    }

    /**
     * Exponential backoff before heal attempt [attemptIndex] (0 = immediate / first request).
     */
    fun autoHealBackoffMs(attemptIndex: Int): Long {
        if (attemptIndex <= 0) return 0L
        val shift = (attemptIndex - 1).coerceAtMost(5)
        val base = AUTO_HEAL_OBSERVE_MS * (1L shl shift)
        return base.coerceAtMost(AUTO_HEAL_MAX_BACKOFF_MS)
    }

    /**
     * User-facing “restoring secure connection” chrome — includes healable idle/error so
     * Wi‑Fi-up + tunnel-down does not look like a silent empty app.
     * Suppressed after explicit user stop (not recovering).
     */
    fun isSecureConnectionReestablishing(
        privateTunnelRuntimeMode: Boolean,
        status: MobilePrivateTunnelStatus,
        configImported: Boolean = false,
        shellAutoHealSuppressed: Boolean = false,
    ): Boolean {
        if (!privateTunnelRuntimeMode || shellAutoHealSuppressed) return false
        return when (status) {
            MobilePrivateTunnelStatus.CONNECTING,
            MobilePrivateTunnelStatus.WAITING_EDGE,
            MobilePrivateTunnelStatus.RETRYING,
            -> true
            MobilePrivateTunnelStatus.DISCONNECTED,
            MobilePrivateTunnelStatus.ERROR,
            -> configImported
            else -> false
        }
    }

    /**
     * @param runAttemptCount WorkManager [androidx.work.ListenableWorker.getRunAttemptCount] (0 on first run).
     */
    fun shouldRetryBackgroundSyncWhenTunnelDeferred(runAttemptCount: Int): Boolean =
        runAttemptCount < MAX_BACKGROUND_SYNC_TUNNEL_DEFER_ATTEMPTS
}
