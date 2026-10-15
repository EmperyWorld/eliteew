package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.tunnel.MobilePrivateTunnelRecoveryPolicy
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus

class MobilePrivateTunnelRecoveryPolicyTest {
    @Test
    fun hardCutoverOnRetryingAndLeavingConnected() {
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(
                MobilePrivateTunnelStatus.CONNECTED,
                MobilePrivateTunnelStatus.RETRYING,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(
                MobilePrivateTunnelStatus.WAITING_EDGE,
                MobilePrivateTunnelStatus.RETRYING,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(
                MobilePrivateTunnelStatus.CONNECTED,
                MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(
                MobilePrivateTunnelStatus.DISCONNECTED,
                MobilePrivateTunnelStatus.CONNECTING,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(
                MobilePrivateTunnelStatus.CONNECTING,
                MobilePrivateTunnelStatus.WAITING_EDGE,
            ),
        )
    }

    @Test
    fun orchestratedResumeOnlyEnteringConnected() {
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldOrchestratedResume(
                MobilePrivateTunnelStatus.RETRYING,
                MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldOrchestratedResume(
                MobilePrivateTunnelStatus.WAITING_EDGE,
                MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldOrchestratedResume(
                MobilePrivateTunnelStatus.CONNECTED,
                MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldOrchestratedResume(
                MobilePrivateTunnelStatus.CONNECTED,
                MobilePrivateTunnelStatus.RETRYING,
            ),
        )
    }

    @Test
    fun secureConnectionReestablishingShellStates() {
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.RETRYING,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.WAITING_EDGE,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.CONNECTING,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
                configImported = true,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.ERROR,
                configImported = true,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
                configImported = false,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = false,
                status = MobilePrivateTunnelStatus.RETRYING,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
                privateTunnelRuntimeMode = true,
                status = MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
                configImported = true,
            ),
        )
    }

    @Test
    fun autoHealOnlyIdleOrErrorWithConfig() {
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.ERROR,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = false,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = false,
                configImported = true,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.CONNECTING,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.VPN_CONFLICT,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                privateTunnelRuntimeMode = true,
                configImported = true,
                status = MobilePrivateTunnelStatus.DISCONNECTED,
                shellAutoHealSuppressed = true,
            ),
        )
    }

    @Test
    fun autoHealBackoffCapsAndStartsAtZero() {
        assertEquals(0L, MobilePrivateTunnelRecoveryPolicy.autoHealBackoffMs(0))
        assertEquals(
            MobilePrivateTunnelRecoveryPolicy.AUTO_HEAL_OBSERVE_MS,
            MobilePrivateTunnelRecoveryPolicy.autoHealBackoffMs(1),
        )
        assertEquals(
            MobilePrivateTunnelRecoveryPolicy.AUTO_HEAL_MAX_BACKOFF_MS,
            MobilePrivateTunnelRecoveryPolicy.autoHealBackoffMs(20),
        )
    }

    @Test
    fun backgroundSyncTunnelDeferRetriesAreBounded() {
        assertTrue(MobilePrivateTunnelRecoveryPolicy.shouldRetryBackgroundSyncWhenTunnelDeferred(0))
        assertTrue(
            MobilePrivateTunnelRecoveryPolicy.shouldRetryBackgroundSyncWhenTunnelDeferred(
                MobilePrivateTunnelRecoveryPolicy.MAX_BACKGROUND_SYNC_TUNNEL_DEFER_ATTEMPTS - 1,
            ),
        )
        assertFalse(
            MobilePrivateTunnelRecoveryPolicy.shouldRetryBackgroundSyncWhenTunnelDeferred(
                MobilePrivateTunnelRecoveryPolicy.MAX_BACKGROUND_SYNC_TUNNEL_DEFER_ATTEMPTS,
            ),
        )
    }
}
