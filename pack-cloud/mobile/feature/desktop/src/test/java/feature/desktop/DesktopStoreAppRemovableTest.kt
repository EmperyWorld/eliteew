package feature.desktop

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.DesktopStoreAppDto

class DesktopStoreAppRemovableTest {
    @Test
    fun factoryAppIsNotRemovable() {
        val app =
            DesktopStoreAppDto(
                app_id = "app-store",
                name = "Магазин",
                is_factory = true,
                can_uninstall = false,
                installed = true,
            )
        assertFalse(app.isRemovableFromDesktop())
    }

    @Test
    fun userInstalledAppIsRemovable() {
        val app =
            DesktopStoreAppDto(
                app_id = "notes",
                name = "Notes",
                is_factory = false,
                is_system = false,
                can_uninstall = true,
                installed = true,
            )
        assertTrue(app.isRemovableFromDesktop())
    }
}
