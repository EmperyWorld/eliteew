/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for GAF visual tokens, persisted style defaults, and reduced-motion policy.
 *
 * Invariants:
 * - Missing/unknown storage → ELITE; explicit STANDARD remains compatible.
 *
 * Related:
 * - ChatVisualStrategy.kt, ChatVisualStyle.kt
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import world.empery.mobile.core.ui.ChatFontColorOption
import world.empery.mobile.core.ui.ChatFontFamilyOption
import world.empery.mobile.core.ui.ChatFontSizeOption
import world.empery.mobile.core.ui.ChatTypographyPreset
import world.empery.mobile.core.ui.ChatTypographyPreferences
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.core.ui.ChatVisualStylePreferences

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ChatVisualStrategyTest {

    @Test
    fun resolve_explicitStandard_returnsStandardSingleton() {
        assertSame(StandardChatVisualStrategy, ChatVisualStrategy.resolve(ChatVisualStyle.STANDARD))
        assertTrue(StandardChatVisualStrategy.showBubbleSurface)
        assertFalse(StandardChatVisualStrategy.showStructuralTimeline)
    }

    @Test
    fun resolve_eliteOrUnset_returnsStructuralTokens() {
        val elite = ChatVisualStrategy.resolve(ChatVisualStyle.ELITE)
        assertSame(EliteChatVisualStrategy, elite)
        assertSame(EliteChatVisualStrategy, ChatVisualStrategy.resolve(null))
        assertFalse(elite.showBubbleSurface)
        assertTrue(elite.showStructuralTimeline)
        assertEquals(0f, elite.bubbleBorderWidth.value)
        assertEquals(0f, elite.bubbleShadowElevation.value)
        assertEquals(0f, elite.bubbleTonalElevationMine.value)
        assertEquals(0f, elite.bubbleTonalElevationOther.value)
        assertEquals(0.5f, elite.structuralLineWidth.value)
        assertEquals(8f, elite.listHorizontalGutter.value)
        assertTrue(elite.showPartnerAvatar)
        assertEquals(28f, elite.avatarSize.value)
        assertEquals(0.1f, elite.structuralDividerAlpha, 0.001f)
        assertTrue(elite.showSenderLabel)
        assertEquals(androidx.compose.ui.text.font.FontWeight.Bold, elite.senderLabelFontWeight)
        assertEquals(androidx.compose.ui.text.font.FontWeight.Medium, elite.bodyFontWeight)
        assertFalse(elite.showBubbleSurface)
    }

    @Test
    fun styleFromStorage_defaultsEliteButKeepsExplicitStandard() {
        assertEquals(ChatVisualStyle.ELITE, ChatVisualStyle.fromStorage(null))
        assertEquals(ChatVisualStyle.ELITE, ChatVisualStyle.fromStorage("nonsense"))
        assertEquals(ChatVisualStyle.ELITE, ChatVisualStyle.fromStorage("elite"))
        assertEquals(ChatVisualStyle.ELITE, ChatVisualStyle.fromStorage("STRUCTURAL"))
        assertEquals(ChatVisualStyle.STANDARD, ChatVisualStyle.fromStorage("standard"))
        assertEquals(ChatVisualStyle.STANDARD, ChatVisualStyle.fromStorage("classic"))
    }

    @Test
    fun reduceMotionEitherSource_disablesAllTimelineTransitions() {
        val systemReduced =
            resolveChatMotionPolicy(
                systemReduceMotion = true,
                profileReduceMotion = false,
            )
        val profileReduced =
            resolveChatMotionPolicy(
                systemReduceMotion = false,
                profileReduceMotion = true,
            )
        val enabled =
            resolveChatMotionPolicy(
                systemReduceMotion = false,
                profileReduceMotion = false,
            )

        listOf(systemReduced, profileReduced).forEach { policy ->
            assertTrue(policy.reduceMotion)
            assertFalse(policy.animateItems)
            assertFalse(policy.animateContent)
            assertFalse(policy.animateGaps)
        }
        assertFalse(enabled.reduceMotion)
        assertTrue(enabled.animateItems)
        assertTrue(enabled.animateContent)
        assertTrue(enabled.animateGaps)
    }

    @Test
    fun preferences_roundTrip() {
        val context = RuntimeEnvironment.getApplication()
        ChatVisualStylePreferences.set(context, ChatVisualStyle.ELITE)
        assertEquals(ChatVisualStyle.ELITE, ChatVisualStylePreferences.get(context))
        ChatVisualStylePreferences.set(context, ChatVisualStyle.STANDARD)
        assertEquals(ChatVisualStyle.STANDARD, ChatVisualStylePreferences.get(context))
    }

    @Test
    fun typographyPreset_matchingAndRoundTrip() {
        val context = RuntimeEnvironment.getApplication()
        ChatTypographyPreferences.setPreset(context, ChatTypographyPreset.READING)
        val reading = ChatTypographyPreferences.get(context)
        assertEquals(ChatFontSizeOption.LG, reading.size)
        assertEquals(ChatFontColorOption.MUTED, reading.color)
        assertEquals(ChatTypographyPreset.READING, ChatTypographyPreset.matching(reading))

        val custom =
            ChatTypographySettings(
                family = ChatFontFamilyOption.MONOSPACE,
                size = ChatFontSizeOption.SM,
                color = ChatFontColorOption.PRIMARY,
            )
        ChatTypographyPreferences.set(context, custom)
        assertEquals(custom, ChatTypographyPreferences.get(context))
        assertEquals(null, ChatTypographyPreset.matching(custom))
    }
}
