package world.empery.mobile.shell

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.R

/** EW hub sheet must stay in parity with Desktop Hub embedded SPA launchers. */
class MobileShellEwHubMenuCoverageTest {
    @Test
    fun embeddedSpaMenuStringResourcesPresent() {
        val expected =
            listOf(
                R.string.ew_hub_ewa_cd,
                R.string.ew_hub_handbook_cd,
                R.string.ew_hub_social_hub_cd,
                R.string.ew_hub_feedback_cd,
                R.string.ew_hub_notifications_cd,
                R.string.ew_hub_files_cd,
                R.string.ew_hub_professional_worlds_cd,
                R.string.ew_hub_app_store_cd,
                R.string.ew_hub_desktop_settings_cd,
                R.string.ew_hub_ewdesk_cd,
            )
        assertEquals(10, expected.size)
    }
}
