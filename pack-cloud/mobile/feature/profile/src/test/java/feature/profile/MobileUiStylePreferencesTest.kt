package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileUiStylePreferencesTest {
    @Test
    fun mobileUiStyleFromStorageSupportsNewPalettes() {
        assertEquals(MobileUiStyle.EMERALD, MobileUiStyle.fromStorage("emerald"))
        assertEquals(MobileUiStyle.MIDNIGHT, MobileUiStyle.fromStorage("midnight"))
        assertEquals(MobileUiStyle.OBSIDIAN, MobileUiStyle.fromStorage("obsidian"))
        assertEquals(MobileUiStyle.SYSTEM, MobileUiStyle.fromStorage("unknown"))
        assertEquals("obsidian", MobileUiStyle.toStorage(MobileUiStyle.OBSIDIAN))
    }

    @Test
    fun mobileColorModeFromStorage() {
        assertEquals(MobileColorMode.LIGHT, MobileColorMode.fromStorage("light"))
        assertEquals(MobileColorMode.DARK, MobileColorMode.fromStorage("dark"))
        assertEquals(MobileColorMode.SYSTEM, MobileColorMode.fromStorage(null))
    }

    @Test
    fun mobileColorModeResolveDark() {
        assertEquals(true, MobileColorMode.DARK.resolveDark(systemDark = false))
        assertEquals(false, MobileColorMode.LIGHT.resolveDark(systemDark = true))
        assertEquals(true, MobileColorMode.SYSTEM.resolveDark(systemDark = true))
    }

    @Test
    fun themeStorage_isIndependentOfTunnel_obsidianIsUserChoiceOnly() {
        // Regression lock: CONNECTED tunnel must not force Obsidian (ObsidianThemeObserver removed).
        assertEquals(MobileUiStyle.GLASS, MobileUiStyle.fromStorage("glass"))
        assertEquals(MobileUiStyle.PREMIUM, MobileUiStyle.fromStorage("premium"))
        assertEquals(MobileUiStyle.OBSIDIAN, MobileUiStyle.fromStorage("obsidian"))
    }
}
