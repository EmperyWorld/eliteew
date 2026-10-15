package world.empery.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.tunnel.MobilePrivateTunnelManager
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobilePrivateTunnelManagerTest {

    @Test
    fun invalidConfigImportPublishesErrorInsteadOfThrowing() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val manager = MobilePrivateTunnelManager(ctx)

        manager.importConfig(
            """
            Interface]
            PrivateKey = invalid

            [Peer]
            PublicKey = invalid
            Endpoint = 93.77.165.185:51822
            """.trimIndent(),
        )

        val state = manager.state.value
        assertEquals(MobilePrivateTunnelStatus.ERROR, state.status)
        assertNotNull(state.error)
    }

    @Test
    fun permissionRejectedPublishesConflictState() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val manager = MobilePrivateTunnelManager(ctx)

        manager.onVpnPermissionRejected()

        val state = manager.state.value
        assertEquals(MobilePrivateTunnelStatus.VPN_CONFLICT, state.status)
        assertNotNull(state.message)
    }
}
