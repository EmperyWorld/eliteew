package world.empery.mobile.upgrade

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus

class MobileUpgradeSessionReconcilePolicyTest {
    @Test
    fun publicModeNeverWaits() {
        assertFalse(MobileUpgradeSessionReconcilePolicy.shouldWaitForPrivateTunnel(false))
        assertTrue(MobileUpgradeSessionReconcilePolicy.shouldWaitForPrivateTunnel(true))
    }

    @Test
    fun connectedIsReady() {
        assertTrue(
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = MobilePrivateTunnelStatus.CONNECTED,
                shellAutoHealSuppressed = false,
            ),
        )
    }

    @Test
    fun connectingIsNotReady() {
        assertFalse(
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = MobilePrivateTunnelStatus.CONNECTING,
                shellAutoHealSuppressed = false,
            ),
        )
        assertFalse(
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = MobilePrivateTunnelStatus.DISCONNECTED,
                shellAutoHealSuppressed = false,
            ),
        )
    }

    @Test
    fun terminalGatesStopWaiting() {
        assertTrue(
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
                shellAutoHealSuppressed = false,
            ),
        )
        assertTrue(
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = MobilePrivateTunnelStatus.DISCONNECTED,
                shellAutoHealSuppressed = true,
            ),
        )
    }
}
