package world.empery.mobile.push

import android.app.Application
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.MobileDeepLinks

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class MobilePushNavigationTest {
    private val context = ApplicationProvider.getApplicationContext<Application>()

    @Test
    fun buildMainActivityIntentFromFcmData_friendsActionCenterNested() {
        val intent =
            MobilePushNavigation.buildMainActivityIntentFromFcmData(
                context,
                mapOf(
                    "tab" to "friends",
                    "focus" to "action_center",
                ),
            )
        requireNotNull(intent)
        assertEquals("friends", intent.getStringExtra(MobileDeepLinks.EXTRA_NAV_ROUTE))
        assertEquals("action_center", intent.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS))
        assertEquals(
            "friends/action-center",
            intent.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_NESTED_ROUTE),
        )
    }

    @Test
    fun buildMainActivityIntentFromFcmData_friendsRequestExtras() {
        val requestId = "11111111-1111-1111-1111-111111111111"
        val intent =
            MobilePushNavigation.buildMainActivityIntentFromFcmData(
                context,
                mapOf(
                    "tab" to "friends",
                    "request_id" to requestId,
                    "focus" to "request",
                ),
            )
        requireNotNull(intent)
        assertEquals("friends", intent.getStringExtra(MobileDeepLinks.EXTRA_NAV_ROUTE))
        assertEquals(requestId, intent.getStringExtra(MobileDeepLinks.EXTRA_FRIEND_REQUEST_ID))
        assertEquals("request", intent.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS))
    }

    @Test
    fun buildMainActivityIntentFromFcmData_inboxIncomingFocus() {
        val intent =
            MobilePushNavigation.buildMainActivityIntentFromFcmData(
                context,
                mapOf("tab" to "inbox"),
            )
        requireNotNull(intent)
        assertEquals("inbox", intent.getStringExtra(MobileDeepLinks.EXTRA_NAV_ROUTE))
        assertEquals("incoming", intent.getStringExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS))
    }

    @Test
    fun buildMainActivityIntentFromFcmData_chatThreadExtra() {
        val chatId = "22222222-2222-2222-2222-222222222222"
        val intent =
            MobilePushNavigation.buildMainActivityIntentFromFcmData(
                context,
                mapOf("tab" to "chat", "chat_id" to chatId),
            )
        requireNotNull(intent)
        assertEquals(chatId, intent.getStringExtra(MobileDeepLinks.EXTRA_CHAT_ID))
    }

    @Test
    fun buildMainActivityIntentFromNotificationParams_desktopHub() {
        val intent =
            MobilePushNavigation.buildMainActivityIntentFromNotificationParams(
                context = context,
                tab = "desktop",
                targetDesktopHubSection = "notes",
            )
        requireNotNull(intent)
        assertEquals("desktop", intent.getStringExtra(MobileDeepLinks.EXTRA_NAV_ROUTE))
        assertEquals("ugs/desktop", intent.getStringExtra(MobileDeepLinks.EXTRA_UGS_NESTED_ROUTE))
        assertEquals("notes", intent.getStringExtra(MobileDeepLinks.EXTRA_DESKTOP_HUB_SECTION))
    }

    @Test
    fun buildMainActivityIntentFromFcmData_invalidTabReturnsNull() {
        assertNull(
            MobilePushNavigation.buildMainActivityIntentFromFcmData(
                context,
                mapOf("tab" to "unknown"),
            ),
        )
    }

    @Test
    fun launchIntentFlags_newTaskAndClearTop() {
        val intent =
            requireNotNull(
                MobilePushNavigation.buildMainActivityIntentFromFcmData(
                    context,
                    mapOf("tab" to "feed"),
                ),
            )
        assertEquals(
            Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP,
            intent.flags and (Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }
}
