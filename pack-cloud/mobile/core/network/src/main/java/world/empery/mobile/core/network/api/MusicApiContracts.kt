package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.POST

data class MusicLyricsRequest(
    val theme: String,
    val style: String,
    val language: String,
    val vocal: String,
    val temperature: Float,
    val cfg_scale: Float,
    val top_p: Float,
    val luna_mode: String? = null,
    /** Enables XL Base lyrics prompt + substance gate/retry on API (`v2_base`). */
    val target_ugs_workflow: String? = null,
)

data class MusicLyricsResponse(
    val lyrics: String,
    val xl_base_valid: Boolean? = null,
)

data class MusicSuggestProductionRequest(
    val lyrics: String,
    val style: String,
    val temperature: Float,
    val cfg_scale: Float,
    val top_p: Float,
)

data class MusicSuggestProductionResponse(
    val vocal: String,
    val bpm: Int,
    val duration_seconds: Int,
    val language: String,
    val timesignature: String,
    val keyscale: String,
)

data class MusicGenerateStyleRequest(
    val lyrics: String,
    val style: String,
    val vocal: String,
    val temperature: Float,
    val cfg_scale: Float,
    val top_p: Float,
    val luna_mode: String? = null,
    /** Как на веб XL-вкладке: усиливает промпт для XL Base / Turbo. */
    val target_ugs_workflow: String? = null,
)

data class MusicGenerateStyleResponse(
    val tags: String,
)

data class MusicGenerateRequest(
    val lyrics: String,
    val style: String,
    val language: String,
    val vocal: String,
    val billing_mode: String = "wizard",
    val generate_title: Boolean = true,
    val tags: String? = null,
    val bpm: Int? = null,
    val duration_seconds: Int? = null,
    val keyscale: String? = null,
    val timesignature: String? = null,
    /** ACE creative / KSampler; для XL Turbo в веб-мастере по умолчанию не передаются. */
    val temperature: Float? = null,
    val cfg_scale: Float? = null,
    val top_p: Float? = null,
    val top_k: Int? = null,
    val min_p: Float? = null,
    /** ACE KSampler cfg (Comfy); взаимоисключающе с [ksampler_use_comfy_template]=true. */
    val cfg: Float? = null,
    val ksampler_use_comfy_template: Boolean? = null,
    val luna_mode: String? = null,
    /** `v2` — XL Turbo, `v2_base` / `v2_sft` — XL Base/SFT (как в веб MusicGenerator). */
    val ugs_workflow: String? = null,
    /** Метка источника для аналитики; для XL Base на веб шлют `xl_base_sft_tab`. */
    val source_mode: String? = null,
)

data class MusicGenerateResponse(
    val status: String? = null,
    val task_id: String? = null,
)

interface MusicApi {
    @POST("music-generator/lyrics")
    suspend fun generateLyrics(@Body request: MusicLyricsRequest): MusicLyricsResponse

    @POST("music-generator/suggest-production-params")
    suspend fun suggestProductionParams(
        @Body request: MusicSuggestProductionRequest,
    ): MusicSuggestProductionResponse

    @POST("music-generator/generate-style")
    suspend fun generateStyle(@Body request: MusicGenerateStyleRequest): MusicGenerateStyleResponse

    @POST("music-generator/generate")
    suspend fun generateMusic(@Body request: MusicGenerateRequest): MusicGenerateResponse
}
