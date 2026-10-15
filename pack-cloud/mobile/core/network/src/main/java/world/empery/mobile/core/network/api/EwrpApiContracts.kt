package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url
import okhttp3.ResponseBody

data class EwrpCreateRequest(
    val topic: String,
    val num_slides: Int = 5,
    val extra_context: String? = null,
    val source_content_id: String? = null,
)

data class EwrpCreateResponse(
    val id: String,
    val status: String,
    val message: String,
)

data class EwrpJobListItem(
    val id: String,
    val title: String,
    val topic: String,
    val num_slides: Int,
    val status: String,
    val progress: Int,
    val created_at: String?,
    val updated_at: String?,
    val completed_at: String?,
)

data class EwrpStatusResponse(
    val id: String,
    val status: String,
    val progress: Int,
    val error_message: String?,
    val pdf_url: String?,
    val pdf_download_token: String?,
)

interface EwrpApi {
    @POST("ewrp")
    suspend fun createJob(@Body request: EwrpCreateRequest): EwrpCreateResponse

    @GET("ewrp/jobs")
    suspend fun getJobs(
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): List<EwrpJobListItem>

    @GET("ewrp/{id}/status")
    suspend fun getJobStatus(@Path("id") id: String): EwrpStatusResponse

    @GET
    @Streaming
    suspend fun downloadPdf(@Url url: String): ResponseBody
}
