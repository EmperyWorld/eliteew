package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.DesktopApi
import world.empery.mobile.core.network.api.DesktopConfigDto

class DesktopApiContractsTest {
    private val gson = Gson()

    @Test
    fun desktopHubRoutesUseConditionalGetPaths() {
        ApiContractPathAssertions.assertGet(DesktopApi::class, "getConfig", "desktop/config")
        ApiContractPathAssertions.assertGet(DesktopApi::class, "getConfigConditional", "desktop/config")
        ApiContractPathAssertions.assertGet(DesktopApi::class, "getShellStateConditional", "desktop/shell-state")
        ApiContractPathAssertions.assertGet(DesktopApi::class, "getInstalledConditional", "desktop/installed")
    }

    @Test
    fun parsesDesktopConfigDtoWithOptionalFields() {
        val json = """
            {
              "id": "cfg-1",
              "user_id": "u-1",
              "wallpaper": "default",
              "icon_size": "medium",
              "theme": "dark",
              "accent_color": "#336699",
              "show_widget": true
            }
        """.trimIndent()
        val dto = gson.fromJson(json, DesktopConfigDto::class.java)
        assertEquals("dark", dto.theme)
        assertEquals(true, dto.show_widget)
    }

    @Test
    fun desktopShellStateRoutesIncludePatchPath() {
        ApiContractPathAssertions.assertGet(DesktopApi::class, "getShellState", "desktop/shell-state")
        ApiContractPathAssertions.assertPatch(DesktopApi::class, "patchShellState", "desktop/shell-state")
    }
}
