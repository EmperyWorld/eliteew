/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap desktop-001…010: remote dashboard summary, shell-state viewer model, handoff stub, ETag cache.
 *
 * Invariants:
 * - Desktop Hub is remote control, not a desktop canvas mirror.
 * - Parity checklist: documentation/product/mobile/MOBILE-ANDROID-UX-PARITY-CHECKLIST.md
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubRepository
 */
package feature.desktop

import world.empery.mobile.core.network.api.DesktopFavoriteDto
import world.empery.mobile.core.network.api.DesktopShellStateDto
import world.empery.mobile.core.network.api.DesktopStoreAppDto

/** desktop-001: remote control dashboard metrics. */
data class DesktopRemoteDashboardSummary(
    val installedCount: Int,
    val pendingTodos: Int,
    val favoritesCount: Int,
    val quietMode: Boolean,
    val nowPlayingTitle: String?,
)

internal fun DesktopHubUiState.toRemoteDashboardSummary(): DesktopRemoteDashboardSummary {
    val track = shellState?.now_playing?.track?.name?.trim()?.takeIf { it.isNotEmpty() }
    return DesktopRemoteDashboardSummary(
        installedCount = installedAppIds.size,
        pendingTodos = widgetTodos.count { !it.completed },
        favoritesCount = favorites.size,
        quietMode = shellState?.quiet_mode == true,
        nowPlayingTitle = track,
    )
}

/** desktop-006: user-language shell-state snapshot lines. */
data class DesktopShellSnapshotLine(
    val labelKey: String,
    val value: String,
)

internal fun DesktopShellStateDto.toSnapshotLines(): List<DesktopShellSnapshotLine> {
    val lines = mutableListOf<DesktopShellSnapshotLine>()
    quiet_mode?.let { quiet ->
        lines +=
            DesktopShellSnapshotLine(
                labelKey = "quiet_mode",
                value = if (quiet) "on" else "off",
            )
    }
    now_playing?.track?.name?.trim()?.takeIf { it.isNotEmpty() }?.let { title ->
        lines += DesktopShellSnapshotLine(labelKey = "now_playing", value = title)
    }
    if (music_playlists.isNotEmpty()) {
        lines +=
            DesktopShellSnapshotLine(
                labelKey = "playlists",
                value = music_playlists.size.toString(),
            )
    }
    return lines
}

/** desktop-004: favorites reorder helper (local order before API sync). */
internal fun reorderDesktopFavorites(
    favorites: List<DesktopFavoriteDto>,
    fromIndex: Int,
    toIndex: Int,
): List<DesktopFavoriteDto> {
    if (fromIndex == toIndex) return favorites
    if (fromIndex !in favorites.indices || toIndex !in favorites.indices) return favorites
    val mutable = favorites.toMutableList()
    val item = mutable.removeAt(fromIndex)
    mutable.add(toIndex, item)
    return mutable
}

/** desktop-009: cross-device handoff draft state. */
data class DesktopHandoffDraft(
    val text: String,
    val expiresEpochMs: Long,
    val recovered: Boolean = false,
)

fun resolveDesktopHandoffDraft(
    draft: String?,
    expiresEpochMs: Long,
    nowEpochMs: Long = System.currentTimeMillis(),
): DesktopHandoffDraft? {
    val text = draft?.trim().orEmpty()
    if (text.isEmpty()) return null
    val expired = expiresEpochMs > 0L && nowEpochMs >= expiresEpochMs
    return DesktopHandoffDraft(text = text, expiresEpochMs = expiresEpochMs, recovered = expired)
}

/** desktop-007: ETag cache holder for config/shell/installed. */
internal class DesktopHubEtagCache {
    var configEtag: String? = null
        private set
    var shellEtag: String? = null
        private set
    var installedEtag: String? = null
        private set

    fun rememberConfig(response: retrofit2.Response<*>) {
        world.empery.mobile.core.network.HttpEtagSupport.parseEtag(response)?.let { configEtag = it }
    }

    fun rememberShell(response: retrofit2.Response<*>) {
        world.empery.mobile.core.network.HttpEtagSupport.parseEtag(response)?.let { shellEtag = it }
    }

    fun rememberInstalled(response: retrofit2.Response<*>) {
        world.empery.mobile.core.network.HttpEtagSupport.parseEtag(response)?.let { installedEtag = it }
    }

    fun invalidateAll() {
        configEtag = null
        shellEtag = null
        installedEtag = null
    }
}

internal fun installedAppsForRemoteControl(
    storeApps: List<DesktopStoreAppDto>,
    installedIds: Set<String>,
): List<DesktopStoreAppDto> =
    storeApps.filter { installedIds.contains(it.app_id) || it.installed == true }
