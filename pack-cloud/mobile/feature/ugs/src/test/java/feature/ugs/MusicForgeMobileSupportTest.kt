package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.MusicForgeModeCapability
import world.empery.mobile.core.network.api.MusicForgeRunResponse
import world.empery.mobile.core.network.api.UnifiedContentDto

class MusicForgeMobileSupportTest {
    @Test
    fun tasteLikeCountDefaultsMissingToZero() {
        assertEquals(0, musicForgeTasteLikeCount(null))
        assertEquals(0, musicForgeTasteLikeCount(-1))
        assertEquals(2, musicForgeTasteLikeCount(2))
    }

    @Test
    fun modeLabelPrefersUiLanguage() {
        val mode =
            MusicForgeModeCapability(
                mode_key = "sft_xl",
                label_ru = "Студия SFT",
                label_en = "SFT Studio",
                is_default = true,
                lane_key = "sft_xl",
            )
        assertEquals("Студия SFT", musicForgeModeLabel(mode, "ru"))
        assertEquals("SFT Studio", musicForgeModeLabel(mode, "en"))
    }

    @Test
    fun resolveModeIndexUsesDefaultKeyThenFlag() {
        val modes =
            listOf(
                MusicForgeModeCapability("base_xl", "Base", "Base", false, "base_xl"),
                MusicForgeModeCapability("sft_xl", "SFT", "SFT", true, "sft_xl"),
                MusicForgeModeCapability("turbo_xl", "Turbo", "Turbo", false, "turbo_xl"),
            )
        assertEquals(2, resolveMusicForgeModeIndex(modes, "turbo_xl"))
        assertEquals(1, resolveMusicForgeModeIndex(modes, null))
        // Unknown key → fall back to is_default (sft_xl at index 1)
        assertEquals(1, resolveMusicForgeModeIndex(modes, "missing"))
    }

    @Test
    fun languageMapsUnsupportedToAuto() {
        assertEquals("ru", musicForgeLanguageForMobile("ru"))
        assertEquals("en", musicForgeLanguageForMobile("EN"))
        assertEquals("auto", musicForgeLanguageForMobile("es"))
        assertEquals("auto", musicForgeLanguageForMobile("fr"))
    }

    @Test
    fun constraintsIncludeVocalAndOptionalLanguageHint() {
        val ru = musicForgeConstraintsForMobile("female", "ru")
        assertTrue(ru.contains("Lead vocal: female"))
        assertFalse(ru.contains("Spanish"))

        val es = musicForgeConstraintsForMobile("male", "es")
        assertTrue(es.contains("Lead vocal: male"))
        assertTrue(es.contains("Spanish"))
    }

    @Test
    fun terminalStatuses() {
        assertTrue(isMusicForgeTerminalStatus("completed"))
        assertTrue(isMusicForgeTerminalStatus("failed"))
        assertTrue(isMusicForgeTerminalStatus("cancelled"))
        assertFalse(isMusicForgeTerminalStatus("running"))
        assertFalse(isMusicForgeTerminalStatus(null))
    }

    @Test
    fun errorMessagePrefersPayloadMessage() {
        val run =
            MusicForgeRunResponse(
                id = "r1",
                status = "failed",
                error_payload = mapOf("step" to "audio_render", "message" to "Insufficient credits"),
            )
        assertEquals("Insufficient credits", musicForgeErrorMessage(run))
    }

    @Test
    fun mergeHistoryDedupesAndPrefersNewerCreatedAt() {
        val forge =
            listOf(
                UnifiedContentDto("a", "Forge A", "audio/mpeg", "2026-07-18T12:00:00Z", 1L),
                UnifiedContentDto("b", "Forge B", "audio/mpeg", "2026-07-18T11:00:00Z", 1L),
            )
        val legacy =
            listOf(
                UnifiedContentDto("b", "Legacy B", "audio/mpeg", "2026-07-18T10:00:00Z", 1L),
                UnifiedContentDto("c", "Legacy C", "audio/mpeg", "2026-07-18T13:00:00Z", 1L),
            )
        val merged = mergeSongHistory(forge, legacy, maxItems = 10)
        assertEquals(listOf("c", "a", "b"), merged.map { it.id })
        assertEquals("Forge B", merged.first { it.id == "b" }.name)
    }

    @Test
    fun runIdFromMetadataReadsMusicForgeKey() {
        assertEquals(null, musicForgeRunIdFromMetadata(null))
        assertEquals(null, musicForgeRunIdFromMetadata(emptyMap()))
        assertEquals(
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            musicForgeRunIdFromMetadata(mapOf("music_forge_run_id" to "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")),
        )
        assertEquals(null, musicForgeRunIdFromMetadata(mapOf("music_forge_run_id" to "  ")))
    }

    @Test
    fun pollDelayBacksOffLikeDesktop() {
        assertEquals(6_000L, nextMusicForgePollDelayMs(MUSIC_FORGE_POLL_MS_MIN))
        assertEquals(9_000L, nextMusicForgePollDelayMs(6_000L))
        assertEquals(MUSIC_FORGE_POLL_MS_MAX, nextMusicForgePollDelayMs(12_000L))
        assertEquals(MUSIC_FORGE_POLL_MS_MAX, nextMusicForgePollDelayMs(MUSIC_FORGE_POLL_MS_MAX))
    }
}
