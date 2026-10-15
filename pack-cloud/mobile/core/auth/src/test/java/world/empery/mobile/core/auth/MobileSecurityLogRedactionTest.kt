package world.empery.mobile.core.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileSecurityLogRedactionTest {
    @Test
    fun redactsBearerToken() {
        val out = redactSecretsForLog("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.x.y")
        assertTrue(out.contains("<redacted>"))
        assertFalse(out.contains("eyJhbGci"))
    }

    @Test
    fun redactsSupportBundleSensitiveKeys() {
        val out =
            redactSupportBundleEntries(
                mapOf(
                    "access_token" to "secret-value",
                    "flavor" to "prod",
                ),
            )
        assertEquals("[REDACTED]", out["access_token"])
        assertEquals("prod", out["flavor"])
    }
}
