// ---
// EliteEW · Empery World
// https://eliteew.ru
// Author: po&T <keysray70@gmail.com>
// ---
// Purpose:
// Unit tests for trusted Meet join URL validation used before opening the GAF WebView call screen.
// Invariants:
// - Only HTTPS `*.eliteew.ru` join URLs pass validation.
// Related:
// - GafMeetWebViewLauncher.kt
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
class GafMeetWebViewLauncherTest {
    @Test
    fun isValidJoinUrl_acceptsMeetHttpsUrl() {
        assertTrue(
            GafMeetWebViewLauncher.isValidJoinUrl(
                "https://meet.eliteew.ru/gaf-chat-room?jwt=eyJ.test.token",
            ),
        )
    }

    @Test
    fun isValidJoinUrl_rejectsHttpAndExternalHosts() {
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("http://meet.eliteew.ru/room"))
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl("https://evil.example/room"))
        assertFalse(GafMeetWebViewLauncher.isValidJoinUrl(""))
    }
}
