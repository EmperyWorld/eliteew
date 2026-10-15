package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.EwrpApi
import world.empery.mobile.core.network.api.EwrpStatusResponse

class EwrpApiContractsTest {
    private val gson = Gson()

    @Test
    fun ewrpRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(EwrpApi::class, "createJob", "ewrp")
        ApiContractPathAssertions.assertGet(EwrpApi::class, "getJobs", "ewrp/jobs")
        ApiContractPathAssertions.assertGet(EwrpApi::class, "getJobStatus", "ewrp/{id}/status")
    }

    @Test
    fun parsesJobStatusResponse() {
        val json = """
            {"id": "job-1", "status": "completed", "progress": 100, "error_message": null, "pdf_url": "/pdf", "pdf_download_token": "tok"}
        """.trimIndent()
        val dto = gson.fromJson(json, EwrpStatusResponse::class.java)
        assertEquals("completed", dto.status)
        assertEquals(100, dto.progress)
    }
}
