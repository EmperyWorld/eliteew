package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class FeedbackHubWebViewLauncherTest {
    @Test
    fun feedbackHubSpaUrl_containsHashRoute() {
        val url = FeedbackHubWebViewLauncher.feedbackHubSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-feedback-hub"))
    }
}
