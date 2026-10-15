package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Test

class UgsSongTopicPolicyExtendedTest {
    @Test
    fun rejectsDotsBetweenProfanityLetters() {
        assertEquals(UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION, validateUgsSongTopic("х.у.й").rejectReason)
    }

    @Test
    fun rejectsExcessiveSpacingObfuscation() {
        assertEquals(UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION, validateUgsSongTopic("х   у   й").rejectReason)
    }

    @Test
    fun rejectsEmptyAfterNormalization() {
        assertEquals(UgsSongTopicRejectReason.EMPTY, validateUgsSongTopic("\t\n").rejectReason)
    }
}
