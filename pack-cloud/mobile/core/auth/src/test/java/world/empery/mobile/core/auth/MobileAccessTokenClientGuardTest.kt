package world.empery.mobile.core.auth

import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileAccessTokenClientGuardTest {
    @Test
    fun acceptsMatchingAzp() {
        val token = jwtWithClaims("""{"azp":"empery-mobile","sub":"u1"}""")
        assertEquals("empery-mobile", MobileAccessTokenClientGuard.azpClaim(token))
        assertTrue(
            MobileAccessTokenClientGuard.isAllowedMobileAccessToken(
                accessToken = token,
                expectedClientId = "empery-mobile",
            ),
        )
    }

    @Test
    fun rejectsWebAzp() {
        val token = jwtWithClaims("""{"azp":"empery-web","sub":"u1"}""")
        assertFalse(
            MobileAccessTokenClientGuard.isAllowedMobileAccessToken(
                accessToken = token,
                expectedClientId = "empery-mobile",
            ),
        )
    }

    @Test
    fun rejectsMissingAzpWhenExpectedSet() {
        val token = jwtWithClaims("""{"sub":"u1"}""")
        assertNull(MobileAccessTokenClientGuard.azpClaim(token))
        assertFalse(
            MobileAccessTokenClientGuard.isAllowedMobileAccessToken(
                accessToken = token,
                expectedClientId = "empery-mobile",
            ),
        )
    }

    @Test
    fun emptyExpectedAllowsAny() {
        val token = jwtWithClaims("""{"azp":"empery-web"}""")
        assertTrue(
            MobileAccessTokenClientGuard.isAllowedMobileAccessToken(
                accessToken = token,
                expectedClientId = "",
            ),
        )
    }

    private fun jwtWithClaims(payloadJson: String): String {
        val header =
            Base64.getUrlEncoder().withoutPadding()
                .encodeToString("""{"alg":"none"}""".toByteArray(Charsets.UTF_8))
        val payload =
            Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payloadJson.toByteArray(Charsets.UTF_8))
        return "$header.$payload.sig"
    }
}
