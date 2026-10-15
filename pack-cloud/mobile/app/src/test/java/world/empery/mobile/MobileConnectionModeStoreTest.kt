package world.empery.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileConnectionModeStoreTest {

    @Test
    fun defaultsToPublicStable() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()

        assertEquals(MobileConnectionMode.PUBLIC_STABLE, MobileConnectionModeStore.read(ctx))
    }

    @Test
    fun persistsPrivateTunnelBeta() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()

        MobileConnectionModeStore.write(ctx, MobileConnectionMode.PRIVATE_TUNNEL_BETA)

        assertEquals(MobileConnectionMode.PRIVATE_TUNNEL_BETA, MobileConnectionModeStore.read(ctx))
    }
}
