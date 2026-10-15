package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MusicXlPipelineSupportTest {
    @Test
    fun mobileSongsUsesXlBasePipeline_isTrue() {
        assertTrue(mobileSongsUsesXlBasePipeline())
    }

    @Test
    fun musicStyleDefaultBpm_knownStyle() {
        assertEquals(174, musicStyleDefaultBpm("drum and bass"))
    }

    @Test
    fun musicStyleDefaultBpm_unknownStyle_fallsBack() {
        assertEquals(118, musicStyleDefaultBpm("unknown_style"))
    }

    @Test
    fun coerceMusicXlBpmForStyle_clampsOutOfGuardRange() {
        val coerced = coerceMusicXlBpmForStyle("ballad", bpm = 140, fallbackBpm = 72)
        assertEquals(72, coerced)
    }

    @Test
    fun coerceMusicXlBpmForStyle_keepsInGuardRange() {
        val coerced = coerceMusicXlBpmForStyle("ballad", bpm = 80, fallbackBpm = 72)
        assertEquals(80, coerced)
    }

    @Test
    fun inferKeyscaleForWizardV2_sadTheme_prefersMinorPool() {
        val key = inferKeyscaleForWizardV2("pop", "одиночество и слёзы", "грусть и боль")
        assertTrue(key.endsWith("minor", ignoreCase = true))
    }

    @Test
    fun inferKeyscaleForWizardV2_happyTheme_prefersMajorPool() {
        val key = inferKeyscaleForWizardV2("pop", "счастье и радость", "улыбка и солнце")
        assertTrue(key.endsWith("major", ignoreCase = true))
    }

    @Test
    fun clampForSuggestProductionApi_clampsOutOfRange() {
        val (t, cfg, topP) = clampForSuggestProductionApi(2f, 10f, 0.5f)
        assertEquals(1f, t, 0.001f)
        assertEquals(4f, cfg, 0.001f)
        assertEquals(0.8f, topP, 0.001f)
    }

    @Test
    fun musicXlSourceMode_matchesWebXlTab() {
        assertEquals("xl_base_sft_tab", MUSIC_XL_SOURCE_MODE)
    }

    @Test
    fun xlBaseBalancedSliders_matchWebPreset() {
        assertFalse(XlBaseBalancedSliders.TEMPERATURE == WizardLlmSliders.TEMPERATURE)
        assertEquals(0.84f, XlBaseBalancedSliders.TEMPERATURE, 0.001f)
    }
}
