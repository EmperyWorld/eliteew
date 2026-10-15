/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for desktop hub remote control (api/v1/desktop/...).
 *
 * Invariants:
 * - Shell-state DTOs stay tolerant to optional backend expansion fields.
 * - Conditional GET uses `If-None-Match` on config, shell-state, and installed lists.
 *
 * Related:
 * - DesktopShellStateWireContracts.kt
 * - documentation/api/ANDROID-API-CONTRACTS.md
 */
package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.Response

data class DesktopPositionDto(
    val x: Double,
    val y: Double,
)

/** Mirrors `DesktopConfigResponse` subset + common extra columns (unknown JSON keys ignored). */
data class DesktopConfigDto(
    val id: String?,
    val user_id: String?,
    val wallpaper: String?,
    val icon_size: String?,
    val theme: String?,
    val accent_color: String?,
    val show_widget: Boolean?,
    val widget_position: DesktopPositionDto?,
    val live_wallpaper: Boolean? = null,
    val snap_to_grid: Boolean? = null,
    val grid_step: String? = null,
    val widgets_panel_position: String? = null,
    val compact_widgets: Boolean? = null,
    val show_widgets_panel: Boolean? = null,
    val wallpapers_history: List<String>? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
)

data class DesktopConfigPatchBody(
    val wallpaper: String? = null,
    val icon_size: String? = null,
    val theme: String? = null,
    val accent_color: String? = null,
    val show_widget: Boolean? = null,
)

data class DesktopShellNowPlayingTrackDto(
    val id: String? = null,
    val name: String? = null,
    val thumbnail_url: String? = null,
    val version: String? = null,
)

data class DesktopShellNowPlayingDto(
    val track: DesktopShellNowPlayingTrackDto? = null,
    val current_time: Double? = null,
    val volume: Double? = null,
)

data class DesktopMusicPlaylistDto(
    val id: String,
    val name: String,
    val track_ids: List<String> = emptyList(),
)

/** Mirrors `DesktopShellStateOut` from `api/routers/desktop.py`. */
data class DesktopShellStateDto(
    val recent_app_ids: List<String> = emptyList(),
    val recent_app_ids_by_desktop: Map<String, List<String>> = emptyMap(),
    val recent_file_ids: List<String> = emptyList(),
    val clipboard_history: List<DesktopShellClipboardItemDto> = emptyList(),
    val virtual_desktops: DesktopVirtualDesktopsDto? = null,
    val windows_snapshot: DesktopWindowsSnapshotDto? = null,
    val workspace_profiles: DesktopWorkspaceProfilesDto? = null,
    val window_layout_presets: List<DesktopWindowLayoutPresetDto> = emptyList(),
    val widgets_layout: DesktopWidgetsLayoutDto? = null,
    val app_collections: List<DesktopAppCollectionDto> = emptyList(),
    val content_shortcuts: List<DesktopContentShortcutDto> = emptyList(),
    val assistant_context_actions: List<DesktopAssistantContextActionDto> = emptyList(),
    val clock_show_seconds: Boolean? = null,
    val timezone: String? = null,
    val quiet_mode: Boolean? = null,
    val now_playing: DesktopShellNowPlayingDto? = null,
    val music_playback: DesktopMusicPlaybackDto? = null,
    val gaf_chat_sound_enabled: Boolean? = null,
    val tray_show_feedback: Boolean? = null,
    val tray_show_assistant: Boolean? = null,
    val music_playlists: List<DesktopMusicPlaylistDto> = emptyList(),
    val visual_style_presets: List<DesktopVisualStylePresetDto> = emptyList(),
    val ewa_hints: Map<String, Any?>? = null,
)

/** Mirrors `DesktopShellStatePatch`; null/absent keys are ignored server-side. */
data class DesktopShellStatePatchBody(
    val recent_app_ids: List<String>? = null,
    val recent_app_ids_by_desktop: Map<String, List<String>>? = null,
    val recent_file_ids: List<String>? = null,
    val clipboard_history: List<DesktopShellClipboardItemDto>? = null,
    val virtual_desktops: DesktopVirtualDesktopsDto? = null,
    val windows_snapshot: DesktopWindowsSnapshotDto? = null,
    val workspace_profiles: DesktopWorkspaceProfilesDto? = null,
    val window_layout_presets: List<DesktopWindowLayoutPresetDto>? = null,
    val widgets_layout: DesktopWidgetsLayoutDto? = null,
    val app_collections: List<DesktopAppCollectionDto>? = null,
    val content_shortcuts: List<DesktopContentShortcutDto>? = null,
    val assistant_context_actions: List<DesktopAssistantContextActionDto>? = null,
    val clock_show_seconds: Boolean? = null,
    val timezone: String? = null,
    val quiet_mode: Boolean? = null,
    val now_playing: DesktopShellNowPlayingDto? = null,
    val music_playback: DesktopMusicPlaybackDto? = null,
    val gaf_chat_sound_enabled: Boolean? = null,
    val tray_show_feedback: Boolean? = null,
    val tray_show_assistant: Boolean? = null,
    val music_playlists: List<DesktopMusicPlaylistDto>? = null,
    val visual_style_presets: List<DesktopVisualStylePresetDto>? = null,
    val ewa_hints: Map<String, Any?>? = null,
)

data class DesktopStoreAppDto(
    val app_id: String,
    val name: String,
    val description: String? = null,
    val category: String? = null,
    val installed: Boolean? = null,
    val icon_url: String? = null,
    val ew_monthly_price: Double? = null,
    val is_system: Boolean? = null,
    val is_factory: Boolean? = null,
    val can_uninstall: Boolean? = null,
)

data class DesktopStoreResponseDto(
    val apps: List<DesktopStoreAppDto>,
)

data class DesktopInstalledResponseDto(
    val app_ids: List<String>,
)

data class DesktopInstallAppBody(
    val app_id: String,
)

data class DesktopWidgetNoteDto(
    val id: String,
    val content: String,
    val color: String? = null,
    val tags: List<String> = emptyList(),
    val created_at: String? = null,
    val updated_at: String? = null,
)

data class DesktopWidgetNoteCreateBody(
    val content: String,
    val color: String? = null,
    val tags: List<String> = emptyList(),
)

data class DesktopWidgetNotePatchBody(
    val content: String? = null,
    val color: String? = null,
    val tags: List<String>? = null,
)

data class DesktopWidgetTodoDto(
    val id: String,
    val text: String,
    val completed: Boolean,
    val priority: String? = null,
    val tags: List<String> = emptyList(),
    val created_at: String? = null,
    val updated_at: String? = null,
)

data class DesktopWidgetTodoCreateBody(
    val text: String,
    val completed: Boolean = false,
    val priority: String? = "normal",
    val tags: List<String> = emptyList(),
)

data class DesktopWidgetTodoPatchBody(
    val text: String? = null,
    val completed: Boolean? = null,
    val priority: String? = null,
    val tags: List<String>? = null,
)

data class DesktopFavoriteDto(
    val id: String,
    val title: String,
    val url: String,
    val icon: String? = null,
    val color: String? = null,
    val sort_order: Int? = null,
)

data class DesktopFavoriteCreateBody(
    val title: String,
    val url: String,
    val icon: String? = null,
    val color: String? = null,
)

interface DesktopApi {
    @GET("desktop/config")
    suspend fun getConfig(): DesktopConfigDto

    @GET("desktop/config")
    suspend fun getConfigConditional(
        @Header("If-None-Match") ifNoneMatch: String?,
    ): Response<DesktopConfigDto>

    @PATCH("desktop/config")
    suspend fun patchConfig(@Body body: DesktopConfigPatchBody): DesktopConfigDto

    @GET("desktop/shell-state")
    suspend fun getShellState(): DesktopShellStateDto

    @GET("desktop/shell-state")
    suspend fun getShellStateConditional(
        @Header("If-None-Match") ifNoneMatch: String?,
    ): Response<DesktopShellStateDto>

    @PATCH("desktop/shell-state")
    suspend fun patchShellState(@Body body: DesktopShellStatePatchBody): DesktopShellStateDto

    @GET("desktop/store")
    suspend fun getStore(): DesktopStoreResponseDto

    @GET("desktop/installed")
    suspend fun getInstalled(): DesktopInstalledResponseDto

    @GET("desktop/installed")
    suspend fun getInstalledConditional(
        @Header("If-None-Match") ifNoneMatch: String?,
    ): Response<DesktopInstalledResponseDto>

    @POST("desktop/installed")
    suspend fun installApp(@Body body: DesktopInstallAppBody)

    @DELETE("desktop/installed/{appId}")
    suspend fun uninstallApp(@Path("appId") appId: String)

    @GET("desktop/widget-notes")
    suspend fun getWidgetNotes(): List<DesktopWidgetNoteDto>

    @POST("desktop/widget-notes")
    suspend fun createWidgetNote(@Body body: DesktopWidgetNoteCreateBody): DesktopWidgetNoteDto

    @PATCH("desktop/widget-notes/{noteId}")
    suspend fun patchWidgetNote(
        @Path("noteId") noteId: String,
        @Body body: DesktopWidgetNotePatchBody,
    ): DesktopWidgetNoteDto

    @DELETE("desktop/widget-notes/{noteId}")
    suspend fun deleteWidgetNote(@Path("noteId") noteId: String)

    @GET("desktop/widget-todos")
    suspend fun getWidgetTodos(): List<DesktopWidgetTodoDto>

    @POST("desktop/widget-todos")
    suspend fun createWidgetTodo(@Body body: DesktopWidgetTodoCreateBody): DesktopWidgetTodoDto

    @PATCH("desktop/widget-todos/{todoId}")
    suspend fun patchWidgetTodo(
        @Path("todoId") todoId: String,
        @Body body: DesktopWidgetTodoPatchBody,
    ): DesktopWidgetTodoDto

    @DELETE("desktop/widget-todos/{todoId}")
    suspend fun deleteWidgetTodo(@Path("todoId") todoId: String)

    @GET("desktop/favorites")
    suspend fun getFavorites(): List<DesktopFavoriteDto>

    @POST("desktop/favorites")
    suspend fun createFavorite(@Body body: DesktopFavoriteCreateBody): DesktopFavoriteDto

    @DELETE("desktop/favorites/{favoriteId}")
    suspend fun deleteFavorite(@Path("favoriteId") favoriteId: String)
}
