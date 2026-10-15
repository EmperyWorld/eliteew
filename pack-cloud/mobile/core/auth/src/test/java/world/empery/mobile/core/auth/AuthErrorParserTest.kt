package world.empery.mobile.core.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthErrorParserTest {
    @Test
    fun parseReason_readsTopLevelReason() {
        val reason = AuthErrorParser.parseReason("""{"reason":"session_replaced","action":"login"}""")
        assertEquals(AuthErrorParser.REASON_SESSION_REPLACED, reason)
    }

    @Test
    fun parseReason_returnsNullForBlankBody() {
        assertNull(AuthErrorParser.parseReason(""))
    }

    @Test
    fun parseReasonFromText_readsSocketAuthPrefix() {
        val reason = AuthErrorParser.parseReasonFromText("connect_error auth:token_expired")
        assertEquals(AuthErrorParser.REASON_TOKEN_EXPIRED, reason)
    }

    @Test
    fun parseReasonFromText_readsKeyValueForm() {
        val reason = AuthErrorParser.parseReasonFromText("Connection refused {reason=session_replaced, action=login}")
        assertEquals(AuthErrorParser.REASON_SESSION_REPLACED, reason)
    }

    @Test
    fun parseReason_readsSessionReplaceConfirmationRequired() {
        val reason =
            AuthErrorParser.parseReason(
                """{"reason":"session_replace_confirmation_required","action":"login"}""",
            )
        assertEquals(AuthErrorParser.REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED, reason)
    }
}
