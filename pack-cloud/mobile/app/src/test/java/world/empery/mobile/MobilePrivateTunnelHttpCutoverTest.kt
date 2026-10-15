package world.empery.mobile

import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.tunnel.MobilePrivateTunnelHttpCutover

class MobilePrivateTunnelHttpCutoverTest {
    @Test
    fun applyToSessionClients_isSafeOnIdleClientsAndClearsPools() {
        val primary = OkHttpClient()
        val secondary = OkHttpClient()
        MobilePrivateTunnelHttpCutover.applyToSessionClients(listOf(primary, secondary))
        assertEquals(0, primary.dispatcher.runningCallsCount())
        assertEquals(0, primary.dispatcher.queuedCallsCount())
        assertEquals(0, primary.connectionPool.connectionCount())
        assertEquals(0, secondary.dispatcher.runningCallsCount())
        assertEquals(0, secondary.connectionPool.connectionCount())
    }

    @Test
    fun applyToSessionClients_isIdempotent() {
        val client = OkHttpClient()
        MobilePrivateTunnelHttpCutover.applyToSessionClients(listOf(client))
        MobilePrivateTunnelHttpCutover.applyToSessionClients(listOf(client))
        assertEquals(0, client.connectionPool.connectionCount())
    }
}
