/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub repository: conditional GET snapshot, widgets, favorites, theme/quiet mutations.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubLogic.kt
 */
package feature.desktop

import world.empery.mobile.core.network.resolveConditionalGet
import world.empery.mobile.core.network.api.DesktopApi
import world.empery.mobile.core.network.api.DesktopConfigDto
import world.empery.mobile.core.network.api.DesktopConfigPatchBody
import world.empery.mobile.core.network.api.DesktopFavoriteCreateBody
import world.empery.mobile.core.network.api.DesktopInstallAppBody
import world.empery.mobile.core.network.api.DesktopInstalledResponseDto
import world.empery.mobile.core.network.api.DesktopShellStateDto
import world.empery.mobile.core.network.api.DesktopShellStatePatchBody
import world.empery.mobile.core.network.api.DesktopWidgetNoteCreateBody
import world.empery.mobile.core.network.api.DesktopWidgetTodoCreateBody
import world.empery.mobile.core.network.api.DesktopWidgetTodoDto

class DesktopHubRepository(
    private val api: DesktopApi,
) {
    private var configEtag: String? = null
    private var shellEtag: String? = null
    private var installedEtag: String? = null
    private var cachedConfig: DesktopConfigDto? = null
    private var cachedShellState: DesktopShellStateDto? = null
    private var cachedInstalledResponse: DesktopInstalledResponseDto? = null

    suspend fun refreshSnapshot(): DesktopHubUiState {
        val config = fetchConfig()
        val shellState = fetchShellState()
        val store = api.getStore()
        val installed = fetchInstalledIds()
        val notes = api.getWidgetNotes()
        val todos = api.getWidgetTodos()
        val favorites = api.getFavorites()
        return DesktopHubUiState(
            config = config,
            shellState = shellState,
            storeApps = store.apps,
            installedAppIds = installed,
            widgetNotes = notes,
            widgetTodos = todos,
            favorites = favorites,
            isLoading = false,
            error = null,
        )
    }

    private suspend fun fetchConfig(): DesktopConfigDto {
        val raw =
            resolveConditionalGet(
                api.getConfigConditional(configEtag),
                cachedConfig,
            ) { configEtag = it }
        val compact = compactConfigWallpapersForMobile(raw)
        cachedConfig = compact
        return compact
    }

    private suspend fun fetchShellState(): DesktopShellStateDto {
        val state =
            resolveConditionalGet(
                api.getShellStateConditional(shellEtag),
                cachedShellState,
            ) { shellEtag = it }
        cachedShellState = state
        return state
    }

    private suspend fun fetchInstalledIds(): Set<String> {
        val response =
            resolveConditionalGet(
                api.getInstalledConditional(installedEtag),
                cachedInstalledResponse,
            ) { installedEtag = it }
        cachedInstalledResponse = response
        return response.app_ids.toSet()
    }

    fun invalidateConditionalGetCachesAfterUpgrade() {
        configEtag = null
        shellEtag = null
        installedEtag = null
        cachedConfig = null
        cachedShellState = null
        cachedInstalledResponse = null
    }

    private fun invalidateConfigCache() {
        configEtag = null
    }

    private fun invalidateInstalledCache() {
        installedEtag = null
    }

    suspend fun installApp(appId: String) {
        api.installApp(DesktopInstallAppBody(app_id = appId))
        invalidateInstalledCache()
    }

    suspend fun uninstallApp(appId: String) {
        api.uninstallApp(appId)
        invalidateInstalledCache()
    }

    suspend fun createWidgetNote(content: String) {
        api.createWidgetNote(
            DesktopWidgetNoteCreateBody(
                content = content,
            ),
        )
    }

    suspend fun deleteWidgetNote(noteId: String) {
        api.deleteWidgetNote(noteId)
    }

    suspend fun createWidgetTodo(text: String) {
        api.createWidgetTodo(
            DesktopWidgetTodoCreateBody(
                text = text,
            ),
        )
    }

    suspend fun toggleWidgetTodo(todo: DesktopWidgetTodoDto) {
        api.patchWidgetTodo(
            todoId = todo.id,
            body = world.empery.mobile.core.network.api.DesktopWidgetTodoPatchBody(
                completed = !todo.completed,
            ),
        )
    }

    suspend fun deleteWidgetTodo(todoId: String) {
        api.deleteWidgetTodo(todoId)
    }

    suspend fun createFavorite(title: String, url: String) {
        api.createFavorite(
            DesktopFavoriteCreateBody(
                title = title,
                url = url,
            ),
        )
    }

    suspend fun deleteFavorite(favoriteId: String) {
        api.deleteFavorite(favoriteId)
    }

    suspend fun cycleTheme(current: String?): DesktopConfigDto {
        val next = resolveNextDesktopTheme(current)
        val patched = api.patchConfig(DesktopConfigPatchBody(theme = next))
        val compact = compactConfigWallpapersForMobile(patched)
        cachedConfig = compact
        invalidateConfigCache()
        return compact
    }

    suspend fun toggleQuietMode(current: Boolean?): DesktopShellStateDto {
        val next = !(current ?: false)
        val patched = api.patchShellState(DesktopShellStatePatchBody(quiet_mode = next))
        cachedShellState = patched
        invalidateShellCache()
        return patched
    }

    private fun invalidateShellCache() {
        shellEtag = null
    }
}

/**
 * Поле [DesktopConfigDto.wallpaper] с сервера может быть огромным `data:image/...;base64,...`.
 * Хранить мегабайты в [DesktopHubUiState] и подставлять в UI нельзя.
 */
internal fun summarizeDataUrlWallpaper(dataUrl: String): String {
    val s = dataUrl.trim()
    val comma = s.indexOf(',')
    val payload = if (comma >= 0 && comma < s.length - 1) s.substring(comma + 1) else s
    val approxKb = maxOf(1L, (payload.length * 3L) / (4L * 1024L))
    val mime = if (comma > 5) {
        s.substring(5, comma).substringBefore(';').ifBlank { "image" }
    } else {
        "image"
    }
    return "embedded ($mime, ~${approxKb} KB)"
}

internal fun compactWallpaperIfDataUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return raw
    val t = raw.trim()
    if (!t.startsWith("data:", ignoreCase = true)) return raw
    return summarizeDataUrlWallpaper(t)
}

internal fun compactConfigWallpapersForMobile(config: DesktopConfigDto): DesktopConfigDto {
    val history = config.wallpapers_history?.map { item ->
        compactWallpaperIfDataUrl(item) ?: item
    }
    return config.copy(
        wallpaper = compactWallpaperIfDataUrl(config.wallpaper) ?: config.wallpaper,
        wallpapers_history = history,
    )
}
