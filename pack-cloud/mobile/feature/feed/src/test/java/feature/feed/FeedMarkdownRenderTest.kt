/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
package feature.feed

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedMarkdownRenderTest {
    @Test
    fun markdownToPlainStripsLinksAndHeadings() {
        val plain = ewDeskMarkdownToPlain("## Title\n\nHello [GAF](/__eliteew-desktop-open-app__/GAFChatApp)")
        assertTrue(plain.contains("Hello"))
        assertTrue(plain.contains("GAF"))
        assertFalse(plain.contains("##"))
        assertFalse(plain.contains("__eliteew"))
    }

    @Test
    fun collapsedPreviewTruncatesWithEllipsis() {
        val long = "word ".repeat(200).trim()
        val preview = ewDeskCollapsedPreviewPlain(long, previewChars = 40)
        assertTrue(preview.endsWith("…"))
        assertTrue(preview.length <= 41)
    }

    @Test
    fun shouldCollapseWhenPlainBodyExceedsThreshold() {
        val body = "x".repeat(EWDESK_BODY_COLLAPSE_CHARS)
        assertTrue(shouldCollapseEwDeskBody(body, body))
    }

    @Test
    fun shouldCollapseWhenLineCountExceedsThreshold() {
        val body = List(EWDESK_BODY_COLLAPSE_LINES) { "line $it" }.joinToString("\n")
        assertTrue(shouldCollapseEwDeskBody(body, ewDeskMarkdownToPlain(body)))
    }

    @Test
    fun heroAspectRatioUsesCompactRatioWhenStacked() {
        assertEquals(4f / 3f, ewDeskHeroAspectRatio(compactLayout = true), 0.001f)
        assertEquals(16f / 9f, ewDeskHeroAspectRatio(compactLayout = false), 0.001f)
    }
}
