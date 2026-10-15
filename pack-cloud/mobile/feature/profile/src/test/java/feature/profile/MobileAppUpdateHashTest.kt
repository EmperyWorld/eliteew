package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream

class MobileAppUpdateHashTest {
    @Test
    fun matchesExpectedAllowsMissingServerHash() {
        assertTrue(MobileAppUpdateHash.matchesExpected("a".repeat(64), null))
    }

    @Test
    fun matchesExpectedComparesLowercaseHex() {
        val hex = "ab".repeat(32)
        assertTrue(MobileAppUpdateHash.matchesExpected(hex, hex.uppercase()))
        assertFalse(MobileAppUpdateHash.matchesExpected(hex, "c".repeat(64)))
    }

    @Test
    fun sha256HexKnownEmptyString() {
        val digest = MobileAppUpdateHash.sha256Hex(ByteArrayInputStream(byteArrayOf()))
        assertTrue(digest.length == 64)
    }
}
