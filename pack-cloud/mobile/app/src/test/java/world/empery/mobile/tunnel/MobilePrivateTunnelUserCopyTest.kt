package world.empery.mobile.tunnel

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobilePrivateTunnelUserCopyTest {

    @Test
    fun failClosedHttpGuardMessageIncludesStableMarker() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val message = MobilePrivateTunnelUserCopy.failClosedHttpGuardMessage(ctx)
        assertTrue(message.isNotBlank())
        assertFalse(message.lowercase().contains("wireguard"))
        assertFalse(message.lowercase().contains("socket"))
    }

    @Test
    fun matchesFailClosedHttpGuardRecognizesMarkerPrefix() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val guardMessage =
            "${MobilePrivateTunnelUserCopy.FAIL_CLOSED_HTTP_GUARD_MARKER}:" +
                MobilePrivateTunnelUserCopy.failClosedHttpGuardMessage(ctx)
        assertTrue(MobilePrivateTunnelUserCopy.matchesFailClosedHttpGuard(guardMessage))
    }

    @Test
    fun sanitizeErrorRedactsOperatorDetail() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val sanitized =
            MobilePrivateTunnelUserCopy.sanitizeError(
                ctx,
                IllegalStateException("GoBackend setState failed for WireGuard peer"),
            )
        assertFalse(sanitized.lowercase().contains("wireguard"))
        assertFalse(sanitized.lowercase().contains("gobackend"))
    }
}
