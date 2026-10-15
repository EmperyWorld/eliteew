/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin Retrofit client for MusicForge `/api/v1/music-forge/` (capabilities + runs).
 *
 * Invariants:
 * - Mobile never sends workflow/model/sampler flags; optional mode_key only.
 * - Create returns 202 + run_id; clients poll GET until a terminal status.
 *
 * Related:
 * - documentation/product/MUSIC-FORGE-APP.md
 * - shared/api/routers/music_forge.py
 */
package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

data class MusicForgeModeCapability(
    val mode_key: String,
    val label_ru: String = "",
    val label_en: String = "",
    val is_default: Boolean = false,
    val lane_key: String = "",
)

data class MusicForgeCapabilitiesResponse(
    val default_language: String? = null,
    val duration_seconds_default: Int? = null,
    val duration_seconds_min: Int? = null,
    val duration_seconds_max: Int? = null,
    val mvp_lane: String? = null,
    val frontend_role: String? = null,
    val config_version: String? = null,
    val modes: List<MusicForgeModeCapability> = emptyList(),
    val default_mode_key: String? = null,
    val taste_profile_like_count: Int? = null,
    val taste_profile_dislike_count: Int? = null,
)

data class MusicForgeRunCreateRequest(
    val idea: String,
    val language: String = "auto",
    val style_hint: String? = null,
    val constraints: String? = null,
    val duration_seconds: Int = 220,
    val mode_key: String? = null,
    val idempotency_key: String? = null,
)

data class MusicForgeRunCreateResponse(
    val run_id: String,
    val status: String,
)

data class MusicForgeLyricsRewriteResponse(
    val run_id: String,
    val status: String,
    val source_run_id: String? = null,
)

data class MusicForgeRunResponse(
    val id: String,
    val status: String,
    val idea: String? = null,
    val language: String? = null,
    val style_hint: String? = null,
    val duration_seconds: Int? = null,
    val progress_current: Int? = null,
    val progress_total: Int? = null,
    val content_id: String? = null,
    val error_payload: Map<String, Any?>? = null,
    val result_payload: Map<String, Any?>? = null,
)

interface MusicForgeApi {
    @GET("music-forge/capabilities")
    suspend fun getCapabilities(): MusicForgeCapabilitiesResponse

    @POST("music-forge/runs")
    suspend fun createRun(@Body request: MusicForgeRunCreateRequest): MusicForgeRunCreateResponse

    @GET("music-forge/runs/{run_id}")
    suspend fun getRun(@Path("run_id") runId: String): MusicForgeRunResponse

    @POST("music-forge/runs/{run_id}/cancel")
    suspend fun cancelRun(@Path("run_id") runId: String): MusicForgeRunResponse

    @POST("music-forge/runs/{run_id}/rewrite-lyrics")
    suspend fun rewriteLyrics(@Path("run_id") runId: String): MusicForgeLyricsRewriteResponse
}
