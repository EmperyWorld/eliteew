package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.MusicForgeApi
import world.empery.mobile.core.network.api.MusicForgeCapabilitiesResponse
import world.empery.mobile.core.network.api.MusicForgeRunCreateRequest
import world.empery.mobile.core.network.api.MusicForgeLyricsRewriteResponse
import world.empery.mobile.core.network.api.MusicForgeRunCreateResponse
import world.empery.mobile.core.network.api.MusicForgeRunResponse

class MusicForgeApiContractsTest {
    private val gson = Gson()

    @Test
    fun musicForgeRoutesMatchBackend() {
        ApiContractPathAssertions.assertGet(
            MusicForgeApi::class,
            "getCapabilities",
            "music-forge/capabilities",
        )
        ApiContractPathAssertions.assertPost(MusicForgeApi::class, "createRun", "music-forge/runs")
        ApiContractPathAssertions.assertGet(MusicForgeApi::class, "getRun", "music-forge/runs/{run_id}")
        ApiContractPathAssertions.assertPost(MusicForgeApi::class, "cancelRun", "music-forge/runs/{run_id}/cancel")
        ApiContractPathAssertions.assertPost(
            MusicForgeApi::class,
            "rewriteLyrics",
            "music-forge/runs/{run_id}/rewrite-lyrics",
        )
    }

    @Test
    fun parsesCapabilitiesTasteProfileCounts() {
        val caps =
            gson.fromJson(
                """
                {
                  "default_mode_key":"sft_xl",
                  "taste_profile_like_count":3,
                  "taste_profile_dislike_count":1,
                  "modes":[]
                }
                """.trimIndent(),
                MusicForgeCapabilitiesResponse::class.java,
            )
        assertEquals(3, caps.taste_profile_like_count)
        assertEquals(1, caps.taste_profile_dislike_count)
    }

    @Test
    fun parsesCapabilitiesAndCreateRequestWithModeKey() {
        val caps =
            gson.fromJson(
                """
                {
                  "default_mode_key":"sft_xl",
                  "modes":[
                    {"mode_key":"sft_xl","label_ru":"SFT","label_en":"SFT","is_default":true,"lane_key":"sft_xl"},
                    {"mode_key":"turbo_xl","label_ru":"Turbo","label_en":"Turbo","is_default":false,"lane_key":"turbo_xl"}
                  ]
                }
                """.trimIndent(),
                MusicForgeCapabilitiesResponse::class.java,
            )
        assertEquals("sft_xl", caps.default_mode_key)
        assertEquals(2, caps.modes.size)
        assertEquals("turbo_xl", caps.modes[1].mode_key)

        val json =
            gson.toJson(
                MusicForgeRunCreateRequest(
                    idea = "Night drive",
                    mode_key = "turbo_xl",
                ),
            )
        assertTrue(json.contains("\"mode_key\":\"turbo_xl\""))
    }

    @Test
    fun parsesCreateAndRunResponses() {
        val created =
            gson.fromJson(
                """{"run_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","status":"queued"}""",
                MusicForgeRunCreateResponse::class.java,
            )
        assertEquals("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", created.run_id)
        assertEquals("queued", created.status)

        val run =
            gson.fromJson(
                """
                {
                  "id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                  "status":"completed",
                  "idea":"Test",
                  "content_id":"11111111-2222-3333-4444-555555555555",
                  "error_payload": {}
                }
                """.trimIndent(),
                MusicForgeRunResponse::class.java,
            )
        assertEquals("completed", run.status)
        assertEquals("11111111-2222-3333-4444-555555555555", run.content_id)
        assertTrue(run.error_payload != null)

        val rewrite =
            gson.fromJson(
                """
                {
                  "run_id":"bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
                  "status":"queued",
                  "source_run_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
                }
                """.trimIndent(),
                MusicForgeLyricsRewriteResponse::class.java,
            )
        assertEquals("bbbbbbbb-cccc-dddd-eeee-ffffffffffff", rewrite.run_id)
        assertEquals("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", rewrite.source_run_id)
    }
}
