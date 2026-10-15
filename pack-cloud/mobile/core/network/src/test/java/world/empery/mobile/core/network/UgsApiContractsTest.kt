package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.UgsApi
import world.empery.mobile.core.network.api.UgsStatsResponse

class UgsApiContractsTest {
    private val gson = Gson()

    @Test
    fun ugsRoutesMatchBackend() {
        ApiContractPathAssertions.assertGet(UgsApi::class, "getStats", "ugs/stats")
        ApiContractPathAssertions.assertGet(UgsApi::class, "getProvidersStatus", "ugs/providers/status")
        ApiContractPathAssertions.assertGet(UgsApi::class, "getBillingStats", "ugs/billing/stats")
    }

    @Test
    fun parsesUgsStatsResponse() {
        val json = """{"total_generations": 10, "active_tasks": 1, "completed_today": 2, "failed_today": 0}"""
        val stats = gson.fromJson(json, UgsStatsResponse::class.java)
        assertEquals(10, stats.total_generations)
        assertEquals(1, stats.active_tasks)
    }
}
