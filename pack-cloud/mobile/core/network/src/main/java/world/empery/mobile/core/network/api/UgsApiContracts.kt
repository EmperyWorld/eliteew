package world.empery.mobile.core.network.api

import retrofit2.http.GET

data class UgsStatsResponse(
    val total_generations: Int,
    val active_tasks: Int,
    val completed_today: Int,
    val failed_today: Int,
)

data class UgsProviderStatus(
    val provider_name: String,
    val display_label: String?,
    val status: String,
    val response_time: Double,
    val last_check: String,
)

data class UgsProvidersOverviewResponse(
    val providers: List<UgsProviderStatus>,
)

data class BillingStatsResponse(
    val available_credits: Double,
    val daily_used: Double,
    val daily_limit: Double,
    val monthly_used: Double,
    val monthly_limit: Double,
    val total_used: Double,
    val active_requests: Int,
    val concurrent_limit: Int,
)

interface UgsApi {
    @GET("ugs/stats")
    suspend fun getStats(): UgsStatsResponse

    @GET("ugs/providers/status")
    suspend fun getProvidersStatus(): UgsProvidersOverviewResponse

    @GET("ugs/billing/stats")
    suspend fun getBillingStats(): BillingStatsResponse
}
