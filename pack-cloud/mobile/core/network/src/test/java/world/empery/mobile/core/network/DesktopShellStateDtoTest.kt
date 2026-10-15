/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gson contract tests for expanded `DesktopShellStateDto` wire fields.
 *
 * Invariants:
 * - Parses nested wire DTOs from `DesktopShellStateWireContracts.kt` without custom adapters.
 *
 * Related:
 * - DesktopApiContracts.kt
 * - DesktopShellStateWireContracts.kt
 */
package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import world.empery.mobile.core.network.api.DesktopShellStateDto

class DesktopShellStateDtoTest {
    private val gson = Gson()

    @Test
    fun parsesExpandedShellStateWire() {
        val json = """
            {
              "recent_app_ids": ["assistant", "gaf-chat"],
              "recent_app_ids_by_desktop": {
                "desktop-1": ["assistant"]
              },
              "recent_file_ids": ["file-1"],
              "clipboard_history": [
                {
                  "id": "clip-1",
                  "type": "text",
                  "content": "hello",
                  "preview": "hello",
                  "timestamp": "2026-06-30T08:00:00Z",
                  "pinned": false,
                  "source": "desktop"
                }
              ],
              "virtual_desktops": {
                "desktops": [
                  { "id": "desktop-1", "name": "Main", "isActive": true }
                ],
                "activeDesktopId": "desktop-1"
              },
              "windows_snapshot": {
                "activeDesktopId": "desktop-1",
                "windows": [
                  {
                    "type": "app",
                    "title": "Assistant",
                    "appComponent": "AssistantApp",
                    "position": { "x": 10.0, "y": 20.0 },
                    "size": { "width": 800.0, "height": 600.0 },
                    "zIndex": 42
                  }
                ]
              },
              "workspace_profiles": {
                "profiles": [
                  {
                    "id": "ws-1",
                    "name": "Focus",
                    "appIds": ["assistant"],
                    "folderItemIds": [],
                    "widgetIds": []
                  }
                ]
              },
              "quiet_mode": true,
              "now_playing": {
                "track": { "id": "track-1", "name": "Song" },
                "current_time": 12.5,
                "volume": 0.8
              },
              "music_playback": {
                "playback_rate": 1.25,
                "shuffle": true,
                "repeat": "all",
                "queue": [
                  { "id": "track-1", "name": "Song" }
                ]
              },
              "music_playlists": [
                { "id": "eliteew-music-favorites", "name": "Любимые", "track_ids": ["track-1"] }
              ],
              "gaf_chat_sound_enabled": false,
              "tray_show_feedback": true,
              "tray_show_assistant": true,
              "clock_show_seconds": false,
              "timezone": "Europe/Moscow",
              "ewa_hints": { "documents_workspace": { "open_documents": [] } }
            }
        """.trimIndent()
        val dto = gson.fromJson(json, DesktopShellStateDto::class.java)
        assertEquals(listOf("assistant", "gaf-chat"), dto.recent_app_ids)
        assertEquals("desktop-1", dto.virtual_desktops?.activeDesktopId)
        assertEquals("Focus", dto.workspace_profiles?.profiles?.first()?.name)
        assertEquals(true, dto.quiet_mode)
        assertEquals("Song", dto.now_playing?.track?.name)
        assertEquals(1.25, dto.music_playback?.playback_rate)
        assertEquals("all", dto.music_playback?.repeat)
        assertEquals(false, dto.gaf_chat_sound_enabled)
        assertNotNull(dto.ewa_hints)
    }
}
