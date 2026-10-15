package world.empery.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.tunnel.MobilePrivateTunnelConnectivity
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus

class MobilePrivateTunnelConnectivityTest {
    @Test
    fun publicModeRequiresPlatformValidated() {
        assertTrue(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = true,
                privateTunnelRuntimeMode = false,
                tunnelStatus = MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = false,
                privateTunnelRuntimeMode = false,
                tunnelStatus = MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
    }

    @Test
    fun privateTunnelConnectedCountsAsOnlineWithoutPlatformValidated() {
        assertTrue(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = false,
                privateTunnelRuntimeMode = true,
                tunnelStatus = MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = false,
                privateTunnelRuntimeMode = true,
                tunnelStatus = MobilePrivateTunnelStatus.CONNECTING,
            ),
        )
    }

    @Test
    fun privateTunnelDisconnectedIsNotOnlineEvenWhenWifiValidated() {
        assertFalse(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = true,
                privateTunnelRuntimeMode = true,
                tunnelStatus = MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertFalse(
            MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
                platformValidated = true,
                privateTunnelRuntimeMode = true,
                tunnelStatus = MobilePrivateTunnelStatus.ERROR,
            ),
        )
    }
}
