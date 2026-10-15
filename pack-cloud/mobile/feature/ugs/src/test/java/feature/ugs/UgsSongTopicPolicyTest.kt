/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the mobile UGS song topic validation policy.
 *
 * Invariants:
 * - Empty, profane, obfuscated and prohibited topics must fail before generation starts.
 *
 * Related:
 * - UgsSongTopicPolicy.kt
 */
package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UgsSongTopicPolicyTest {
    @Test
    fun acceptsCleanTopic() {
        val result = validateUgsSongTopic("летний рассвет")

        assertTrue(result.isValid)
        assertEquals("летний рассвет", result.normalizedTopic)
    }

    @Test
    fun acceptsCleanTopicWithCommonLetters() {
        val result = validateUgsSongTopic("небо и море")

        assertTrue(result.isValid)
        assertEquals("небо и море", result.normalizedTopic)
    }

    @Test
    fun rejectsEmptyTopic() {
        val result = validateUgsSongTopic("   ")

        assertEquals(UgsSongTopicRejectReason.EMPTY, result.rejectReason)
    }

    @Test
    fun rejectsObfuscatedProfanity() {
        val result = validateUgsSongTopic("х у й")

        assertEquals(UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION, result.rejectReason)
    }

    @Test
    fun rejectsMixedAlphabetProfanity() {
        val result = validateUgsSongTopic("xyй")

        assertEquals(UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION, result.rejectReason)
    }

    @Test
    fun rejectsProhibitedContent() {
        val result = validateUgsSongTopic("песня про бомбу")

        assertEquals(UgsSongTopicRejectReason.PROHIBITED_CONTENT, result.rejectReason)
    }
}
