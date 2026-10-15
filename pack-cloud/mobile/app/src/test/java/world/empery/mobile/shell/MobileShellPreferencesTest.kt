package world.empery.mobile.shell

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileShellPreferencesTest {
    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context
            .getSharedPreferences("empery_mobile_shell", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
    }

    @Test
    fun resolveStartDestination_defaultsToFeed() {
        assertEquals(MobileRouteRegistry.defaultStartRoute, MobileShellPreferences.resolveStartDestination(context))
    }

    @Test
    fun roundTrip_lastBottomTab() {
        MobileShellPreferences.setLastBottomTabRoute(context, "profile")
        assertEquals("profile", MobileShellPreferences.getLastBottomTabRoute(context))
        assertEquals("profile", MobileShellPreferences.resolveStartDestination(context))
    }

    @Test
    fun ignoresInvalidRoutes() {
        MobileShellPreferences.setLastBottomTabRoute(context, "ugs/chat")
        assertNull(MobileShellPreferences.getLastBottomTabRoute(context))
        assertEquals(MobileRouteRegistry.defaultStartRoute, MobileShellPreferences.resolveStartDestination(context))
    }

    @Test
    fun roundTrip_notificationsBottomTab() {
        MobileShellPreferences.setLastBottomTabRoute(context, "notifications")
        assertEquals("notifications", MobileShellPreferences.getLastBottomTabRoute(context))
        assertEquals("notifications", MobileShellPreferences.resolveStartDestination(context))
    }

    @Test
    fun clear_removesPersistedTab() {
        MobileShellPreferences.setLastBottomTabRoute(context, "chat")
        MobileShellPreferences.clearLastBottomTabRoute(context)
        assertNull(MobileShellPreferences.getLastBottomTabRoute(context))
    }
}
