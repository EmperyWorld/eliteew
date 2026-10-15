package world.empery.mobile.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileShellRoadmapSupportTest {
    @Test
    fun bottomNavCdSelected() {
        val cd =
            bottomNavTabContentDescription(
                tabTitle = "Feed",
                selected = true,
                selectedTemplate = "%s, selected",
                unselectedTemplate = "%s",
            )
        assertEquals("Feed, selected", cd)
    }

    @Test
    fun bottomNavCdUnreadBadge() {
        val cd =
            bottomNavTabContentDescription(
                tabTitle = "Chat",
                selected = false,
                selectedTemplate = "%s, selected",
                unselectedTemplate = "%s",
                unreadCount = 3,
                unreadTemplate = { "Chat, unread: $it" },
            )
        assertEquals("Chat, unread: 3", cd)
    }

    @Test
    fun runtimeDiagnosticsRowsContainFlavor() {
        val rows =
            buildRuntimeDiagnosticsRows(
                flavor = "prod",
                buildType = "debug",
                versionName = "0.2.30",
                versionCode = 40,
                apiRootHost = "app.eliteew.ru",
                socketState = "CONNECTED",
                reduceMotion = false,
                fontStress = false,
                strictModeDebug = true,
            )
        assertTrue(rows.any { it.label == "flavor" && it.value == "prod" })
    }
}
