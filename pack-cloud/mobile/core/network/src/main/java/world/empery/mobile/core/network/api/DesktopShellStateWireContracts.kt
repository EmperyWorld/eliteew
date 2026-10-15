/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wire DTOs for `GET/PATCH /api/v1/desktop/shell-state` expansion fields beyond music/quiet-mode.
 *
 * Invariants:
 * - Tolerant optional fields; unknown JSON keys are ignored by Gson.
 * - Mirrors `DesktopShellStateOut` / nested wire models in `api/routers/desktop.py`.
 *
 * Related:
 * - DesktopApiContracts.kt
 * - documentation/api/ANDROID-API-CONTRACTS.md
 */
package world.empery.mobile.core.network.api

data class DesktopShellClipboardItemDto(
    val id: String? = null,
    val type: String? = null,
    val content: String? = null,
    val preview: String? = null,
    val timestamp: String? = null,
    val pinned: Boolean? = null,
    val source: String? = null,
)

data class DesktopWindowSizeDto(
    val width: Double? = null,
    val height: Double? = null,
)

data class DesktopWindowSnapshotRowDto(
    val type: String? = null,
    val title: String? = null,
    val appComponent: String? = null,
    val folderId: String? = null,
    val position: DesktopPositionDto? = null,
    val size: DesktopWindowSizeDto? = null,
    val zIndex: Int? = null,
)

data class DesktopWindowsSnapshotDto(
    val activeDesktopId: String? = null,
    val windows: List<DesktopWindowSnapshotRowDto> = emptyList(),
)

data class DesktopVirtualDesktopDto(
    val id: String,
    val name: String? = null,
    val wallpaper: String? = null,
    val isActive: Boolean? = null,
)

data class DesktopVirtualDesktopsDto(
    val desktops: List<DesktopVirtualDesktopDto> = emptyList(),
    val activeDesktopId: String? = null,
)

data class DesktopWorkspaceProfileDto(
    val id: String,
    val name: String = "",
    val description: String? = null,
    val desktopId: String? = null,
    val wallpaper: String? = null,
    val appIds: List<String> = emptyList(),
    val folderItemIds: List<String> = emptyList(),
    val widgetIds: List<String> = emptyList(),
)

data class DesktopWorkspaceProfilesDto(
    val profiles: List<DesktopWorkspaceProfileDto> = emptyList(),
)

data class DesktopWindowLayoutPresetDto(
    val id: String,
    val name: String = "",
    val description: String? = null,
    val windows: List<DesktopWindowSnapshotRowDto> = emptyList(),
    val createdAt: String? = null,
)

data class DesktopAppCollectionDto(
    val id: String,
    val name: String = "",
    val description: String? = null,
    val appIds: List<String> = emptyList(),
    val workspaceProfileId: String? = null,
)

data class DesktopContentShortcutDto(
    val id: String,
    val label: String = "",
    val type: String = "project-folder",
    val target: Map<String, String> = emptyMap(),
    val workspaceProfileId: String? = null,
)

data class DesktopAssistantContextActionDto(
    val id: String,
    val label: String = "",
    val description: String? = null,
    val source: String = "selection",
    val assistantTarget: String = "assistant",
    val enabled: Boolean = true,
)

data class DesktopWidgetLayoutSlotDto(
    val id: String,
    val type: String = "notes",
    val enabled: Boolean = true,
    val mode: String = "compact",
    val position: Map<String, Any?>? = null,
    val workspaceProfileId: String? = null,
)

data class DesktopWidgetsLayoutDto(
    val slots: List<DesktopWidgetLayoutSlotDto> = emptyList(),
    val perWorkspace: Boolean = false,
)

data class DesktopVisualStylePresetDto(
    val id: String,
    val name: String,
    val theme: String? = null,
    val accentFollows: Boolean? = null,
    val wallpaperIndex: Int? = null,
    val wallpaperRef: String? = null,
    val accent: String? = null,
    val windowStyle: String? = null,
    val taskbarStyle: String? = null,
    val iconStyle: String? = null,
    val widgetsStyle: String? = null,
    val desktopPanelOpacity: Double? = null,
    val desktopUiScale: Double? = null,
    val createdAt: String? = null,
)

data class DesktopMusicPlaybackDto(
    val playback_rate: Double? = null,
    val shuffle: Boolean? = null,
    val repeat: String? = null,
    val queue: List<DesktopShellNowPlayingTrackDto> = emptyList(),
)
