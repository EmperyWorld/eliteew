// ---
// EliteEW · Empery World · https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// JVM smoke for GAF Meet WebView join URL validation and permission-gated launch contract.
// Invariants:
// - Invalid join URLs never pass [GafMeetWebViewLauncher.isValidJoinUrl].
// Related:
// - GafMeetWebViewLauncher.kt, GafVideoCallJoinFlowTest.kt
// ---
package feature.chat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class GafVideoCallWebViewSmokeTest {
    @Test
    fun joinUrlSmoke_validMeetHostAndJwtQuery() {
        val url = "https://meet.eliteew.ru/gaf-chat-abc?jwt=eyJhbGciOiJIUzI1NiJ9.test"
        assertTrue(GafMeetWebViewLauncher.isValidJoinUrl(url))
    }

    @Test
    fun joinUrlSmoke_rejectsMissingSchemeAndUntrustedHost() {
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("meet.eliteew.ru/room"))
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("https://phishing.example/meet"))
    }

    @Test
    fun joinUrlSmoke_emptyAndWhitespaceRejected() {
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("   "))
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("https://meet.eliteew.ru/"))
    }
}
