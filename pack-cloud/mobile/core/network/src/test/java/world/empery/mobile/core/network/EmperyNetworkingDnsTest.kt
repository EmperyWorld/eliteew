package world.empery.mobile.core.network

import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmperyNetworkingDnsTest {

    @Test
    fun meetHostUsesPublicDnsBeforeSystemSplitDns() {
        val publicAddress = inet4(158, 160, 205, 181)
        val splitLanAddress = inet4(192, 168, 1, 136)
        val publicDns = RecordingDns(result = listOf(publicAddress))
        val systemDns = RecordingDns(result = listOf(splitLanAddress))

        val resolved =
            EmperyNetworkingDns
                .splitHorizonSafeDnsForTesting(publicDns = publicDns, systemDns = systemDns)
                .lookup("meet.eliteew.ru")

        assertEquals(listOf(publicAddress), resolved)
        assertEquals(listOf("meet.eliteew.ru"), publicDns.lookups)
        assertTrue(systemDns.lookups.isEmpty())
    }

    @Test
    fun nonSplitHostUsesSystemDnsOnly() {
        val publicDns = RecordingDns(result = listOf(inet4(158, 160, 205, 181)))
        val systemAddress = inet4(203, 0, 113, 10)
        val systemDns = RecordingDns(result = listOf(systemAddress))

        val resolved =
            EmperyNetworkingDns
                .splitHorizonSafeDnsForTesting(publicDns = publicDns, systemDns = systemDns)
                .lookup("example.com")

        assertEquals(listOf(systemAddress), resolved)
        assertTrue(publicDns.lookups.isEmpty())
        assertEquals(listOf("example.com"), systemDns.lookups)
    }

    @Test
    fun splitHostFallsBackToSystemDnsWhenPublicDnsFails() {
        val publicDns = RecordingDns(failure = UnknownHostException("DoH unavailable"))
        val systemAddress = inet4(192, 168, 1, 136)
        val systemDns = RecordingDns(result = listOf(systemAddress))

        val resolved =
            EmperyNetworkingDns
                .splitHorizonSafeDnsForTesting(publicDns = publicDns, systemDns = systemDns)
                .lookup("meet.eliteew.ru")

        assertEquals(listOf(systemAddress), resolved)
        assertEquals(listOf("meet.eliteew.ru"), publicDns.lookups)
        assertEquals(listOf("meet.eliteew.ru"), systemDns.lookups)
    }

    @Test
    fun privateTunnelModeUsesSplitDnsWithTunnelEdgeFallback() {
        val tunnelEdge = inet4(10, 88, 88, 1)
        val systemDns = RecordingDns(failure = UnknownHostException("VPN DNS not ready"))
        val dns =
            EmperyNetworkingDns.privateTunnelSplitDnsForTesting(
                systemDns = systemDns,
                tunnelEdgeFallback = tunnelEdge,
            )

        val resolved = dns.lookup("app.eliteew.ru")

        assertEquals(listOf(tunnelEdge), resolved)
        assertEquals(listOf("app.eliteew.ru"), systemDns.lookups)
    }

    @Test
    fun privateTunnelModeKeepsSystemDnsWhenItResolves() {
        val tunnelEdge = inet4(10, 88, 88, 1)
        val systemAddress = inet4(10, 88, 88, 1)
        val systemDns = RecordingDns(result = listOf(systemAddress))
        val dns =
            EmperyNetworkingDns.privateTunnelSplitDnsForTesting(
                systemDns = systemDns,
                tunnelEdgeFallback = tunnelEdge,
            )

        assertEquals(listOf(systemAddress), dns.lookup("app.eliteew.ru"))
    }

    @Test
    fun okhttpDnsPrivateTunnelModeUsesSplitDnsNotRawSystem() {
        val dns =
            EmperyNetworkingDns.okhttpDns(
                apiBaseUrl = "https://app.eliteew.ru/api/v1/",
                ssoLoginUrl = "https://app.eliteew.ru/api/v1/auth/sso/login",
                forceSystemDns = true,
            )

        assertTrue(dns.javaClass.simpleName.contains("PrivateTunnelSplitDns"))
    }

    private class RecordingDns(
        private val result: List<InetAddress> = emptyList(),
        private val failure: UnknownHostException? = null,
    ) : Dns {
        val lookups = mutableListOf<String>()

        override fun lookup(hostname: String): List<InetAddress> {
            lookups += hostname
            failure?.let { throw it }
            return result
        }
    }

    private fun inet4(a: Int, b: Int, c: Int, d: Int): InetAddress =
        InetAddress.getByAddress(byteArrayOf(a.toByte(), b.toByte(), c.toByte(), d.toByte()))
}
