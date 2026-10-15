/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for perimeter health probe classification.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - PerimeterAccessProbe.kt
 */
package world.empery.mobile.core.network

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

class PerimeterAccessProbeTest {
    @Test
    fun healthUrlFromApiBase_stripsApiV1Suffix() {
        val url = PerimeterAccessProbe.healthUrlFromApiBase("https://app.eliteew.ru/api/v1/")
        assertEquals("https://app.eliteew.ru/api/health", url)
    }

    @Test
    fun probeSync_openWhenHealthReturns200() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(200).setBody("{\"status\":\"ok\"}"))
        server.start()
        try {
            val probe = PerimeterAccessProbe(server.url("/api/health").toString())
            val result = probe.probeSync(networkValidated = true)
            assertEquals(PerimeterProbeOutcome.Open, result.outcome)
            assertEquals(200, result.httpStatus)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun probeSync_closedOnTimeoutLikeFailure() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(503))
        server.start()
        try {
            val probe = PerimeterAccessProbe(server.url("/api/health").toString())
            val result = probe.probeSync(networkValidated = true)
            assertEquals(PerimeterProbeOutcome.Closed, result.outcome)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun probeSync_noNetworkWhenNotValidated() {
        val probe = PerimeterAccessProbe("https://example.invalid/api/health")
        val result = probe.probeSync(networkValidated = false)
        assertEquals(PerimeterProbeOutcome.NoNetwork, result.outcome)
    }
}
