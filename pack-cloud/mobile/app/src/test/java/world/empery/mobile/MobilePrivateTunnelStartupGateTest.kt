package world.empery.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.tunnel.MobilePrivateTunnelManager
import world.empery.mobile.tunnel.MobilePrivateTunnelNetworkGuardInterceptor
import world.empery.mobile.tunnel.MobilePrivateTunnelUserCopy
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus
import java.io.IOException

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobilePrivateTunnelStartupGateTest {

    @Test
    fun publicStableNeverBlocksEliteEwTraffic() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        MobileConnectionModeStore.write(ctx, MobileConnectionMode.PUBLIC_STABLE)

        assertFalse(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
    }

    @Test
    fun privateTunnelBlocksUntilConnected() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        MobileConnectionModeStore.write(ctx, MobileConnectionMode.PRIVATE_TUNNEL_BETA)

        assertTrue(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.DISCONNECTED,
            ),
        )
        assertTrue(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.VPN_CONFLICT,
            ),
        )
        assertTrue(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.WAITING_EDGE,
            ),
        )
        assertTrue(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.CONNECTING,
            ),
        )
        assertTrue(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.RETRYING,
            ),
        )
        assertFalse(
            MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(
                ctx,
                MobilePrivateTunnelStatus.CONNECTED,
            ),
        )
    }

    @Test
    fun networkGuardFailsClosedBeforeHttpLeavesTheProcess() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        MobileConnectionModeStore.write(ctx, MobileConnectionMode.PRIVATE_TUNNEL_BETA)
        val manager = MobilePrivateTunnelManager(ctx)
        val client =
            OkHttpClient.Builder()
                .addInterceptor(MobilePrivateTunnelNetworkGuardInterceptor(ctx, manager))
                .build()
        val request =
            Request.Builder()
                .url("https://app.eliteew.ru/api/v1/mobile-app/profile")
                .build()

        val error =
            try {
                client.newCall(request).execute()
                null
            } catch (err: IOException) {
                err
            }

        assertTrue(
            MobilePrivateTunnelUserCopy.matchesFailClosedHttpGuard(error?.message),
        )
    }
}
