package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileScaleChromePolicyTest {
    @Test
    fun compactAtBaseFont_keepsSubtitleAndTextButtons() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.COMPACT, systemFontScale = 1f)
        assertTrue(policy.showSecondarySubtitle)
        assertFalse(policy.useIconOnlyActions)
        assertFalse(policy.shouldStackChromeActions)
        assertEquals(64f, policy.minimumTouchTargetDp.value, 0.01f)
    }

    @Test
    fun comfort_usesIconOnlyAndStacksAtHighFont() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.COMFORT, systemFontScale = 1.15f)
        assertTrue(policy.useIconOnlyActions)
        assertTrue(policy.shouldStackChromeActions)
        assertEquals(0, policy.maxHeroSubtitleLines)
    }

    @Test
    fun standardAtLargeSystemFont_stacksChrome() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.STANDARD, systemFontScale = 1.2f)
        assertTrue(policy.shouldStackChromeActions)
        assertTrue(policy.useIconOnlyActions)
    }

    @Test
    fun compactAtBaseFont_exposesFullLineBudgets() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.COMPACT, systemFontScale = 1f)
        assertEquals(3, policy.maxCardTitleLines)
        assertEquals(2, policy.maxCaptionLines)
        assertEquals(3, policy.maxDescriptionLines)
        assertEquals(4, policy.maxNotificationMessageLines)
        assertEquals(3, policy.maxThreadPreviewLines)
        assertEquals(2, policy.maxMetadataLines)
        assertTrue(policy.showInlineRowQuickActions)
        assertEquals(MOBILE_BODY_PREVIEW_CHARS_DEFAULT, policy.bodyPreviewCharBudget)
    }

    @Test
    fun comfortAtHighFont_tightensLineBudgetsAndPreviewChars() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.COMFORT, systemFontScale = 1.15f)
        assertEquals(2, policy.maxCardTitleLines)
        assertEquals(1, policy.maxCaptionLines)
        assertEquals(2, policy.maxDescriptionLines)
        assertEquals(3, policy.maxNotificationMessageLines)
        assertEquals(2, policy.maxThreadPreviewLines)
        assertEquals(1, policy.maxMetadataLines)
        assertFalse(policy.showInlineRowQuickActions)
        assertEquals(MOBILE_BODY_PREVIEW_CHARS_STACKED, policy.bodyPreviewCharBudget)
    }

    @Test
    fun comfortWithSmallSystemFont_usesComfortPreviewCharBudget() {
        val policy = resolveMobileScaleChromePolicy(MobileUiScale.COMFORT, systemFontScale = 0.85f)
        assertFalse(policy.shouldStackChromeActions)
        assertEquals(MOBILE_BODY_PREVIEW_CHARS_COMFORT, policy.bodyPreviewCharBudget)
        assertEquals(3, policy.maxBodyPreviewLines)
    }
}
