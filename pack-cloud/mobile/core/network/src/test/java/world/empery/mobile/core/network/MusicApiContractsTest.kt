package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.MusicApi
import world.empery.mobile.core.network.api.MusicLyricsResponse

class MusicApiContractsTest {
    private val gson = Gson()

    @Test
    fun musicGeneratorRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(MusicApi::class, "generateLyrics", "music-generator/lyrics")
        ApiContractPathAssertions.assertPost(
            MusicApi::class,
            "suggestProductionParams",
            "music-generator/suggest-production-params",
        )
        ApiContractPathAssertions.assertPost(MusicApi::class, "generateStyle", "music-generator/generate-style")
        ApiContractPathAssertions.assertPost(MusicApi::class, "generateMusic", "music-generator/generate")
    }

    @Test
    fun parsesLyricsResponse() {
        val json = """{"lyrics": "Verse one"}"""
        val resp = gson.fromJson(json, MusicLyricsResponse::class.java)
        assertEquals("Verse one", resp.lyrics)
    }
}
