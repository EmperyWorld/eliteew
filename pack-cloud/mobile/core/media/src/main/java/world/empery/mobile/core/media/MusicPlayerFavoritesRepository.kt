/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sync music player favorites with desktop shell_state (`music_playlists`), same as web player.
 *
 * Invariants:
 * - Favorites live in playlist id `eliteew-music-favorites`; PATCH sends full normalized playlist set.
 * - Track metadata resolved from unified content audio list (compact profile).
 *
 * Related:
 * - MusicPlayerPlaylistsSupport.kt, EmperyExpandedPlayerSheet.kt, DesktopApi
 */
package world.empery.mobile.core.media

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import world.empery.mobile.core.network.UnifiedContentUrls
import world.empery.mobile.core.network.api.DesktopApi
import world.empery.mobile.core.network.api.DesktopShellStatePatchBody
import world.empery.mobile.core.network.api.MUSIC_FAVORITES_PLAYLIST_ID
import world.empery.mobile.core.network.api.MusicSavedPlaylist
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.favoriteTrackIdsFromPlaylists
import world.empery.mobile.core.network.api.listAllContent
import world.empery.mobile.core.network.api.normalizeMusicPlaylistsWithFavorites
import world.empery.mobile.core.network.api.savedMusicPlaylistsToShellPatch
import world.empery.mobile.core.network.api.shellMusicPlaylistsToSaved
import world.empery.mobile.core.network.api.storedThumbnailAbsoluteUrl

class MusicPlayerFavoritesRepository(
    private val desktopApi: DesktopApi,
    private val contentApi: UnifiedContentApi,
    private val apiBaseUrl: String,
    private val scope: CoroutineScope,
) {
    private val mutex = Mutex()

    private val _playlists = MutableStateFlow<List<MusicSavedPlaylist>>(emptyList())
    private val _favoriteIds = MutableStateFlow<Set<String>>(emptySet())
    val favoriteIds: StateFlow<Set<String>> = _favoriteIds.asStateFlow()

    private val _favoriteTracks = MutableStateFlow<List<EmperyMediaTrack>>(emptyList())
    val favoriteTracks: StateFlow<List<EmperyMediaTrack>> = _favoriteTracks.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    suspend fun refresh() {
        mutex.withLock {
            _loading.value = true
            try {
                val shell = desktopApi.getShellState()
                applyPlaylists(shellMusicPlaylistsToSaved(shell.music_playlists))
            } finally {
                _loading.value = false
            }
        }
    }

    fun toggleFavorite(trackId: String) {
        val normalizedId = trackId.trim()
        if (normalizedId.isEmpty()) return
        scope.launch {
            mutex.withLock {
                val current = _playlists.value.ifEmpty { normalizeMusicPlaylistsWithFavorites(emptyList()) }
                val next =
                    current.map { playlist ->
                        if (playlist.id != MUSIC_FAVORITES_PLAYLIST_ID) {
                            playlist
                        } else {
                            val has = playlist.trackIds.contains(normalizedId)
                            playlist.copy(
                                trackIds =
                                    if (has) {
                                        playlist.trackIds.filter { it != normalizedId }
                                    } else {
                                        playlist.trackIds + normalizedId
                                    },
                            )
                        }
                    }
                val normalized = normalizeMusicPlaylistsWithFavorites(next)
                applyPlaylists(normalized)
                try {
                    desktopApi.patchShellState(
                        DesktopShellStatePatchBody(
                            music_playlists = savedMusicPlaylistsToShellPatch(normalized),
                        ),
                    )
                } catch (_: Exception) {
                    refresh()
                }
            }
        }
    }

    fun isFavorite(trackId: String): Boolean = _favoriteIds.value.contains(trackId.trim())

    private suspend fun applyPlaylists(normalized: List<MusicSavedPlaylist>) {
        _playlists.value = normalized
        val orderedIds = favoriteTrackIdsFromPlaylists(normalized)
        _favoriteIds.value = orderedIds.toSet()
        _favoriteTracks.value = resolveFavoriteTracks(orderedIds)
    }

    private suspend fun resolveFavoriteTracks(orderedIds: List<String>): List<EmperyMediaTrack> {
        if (orderedIds.isEmpty()) return emptyList()
        val audioItems =
            runCatching {
                contentApi.listAllContent(
                    contentType = "audio",
                    ownerOnly = true,
                    pageSize = 100,
                    maxItems = 2000,
                )
            }.getOrDefault(emptyList())
        val byId = audioItems.associateBy { it.id }
        return orderedIds.map { id ->
            val item = byId[id]
            EmperyMediaTrack(
                id = id,
                title = item?.name?.takeIf { it.isNotBlank() } ?: id.take(8),
                uri = UnifiedContentUrls.downloadUrl(apiBaseUrl, id),
                mimeType = item?.mime_type ?: "audio/mpeg",
                subtitle = null,
                artworkUrl = item?.storedThumbnailAbsoluteUrl(apiBaseUrl),
            )
        }
    }
}

object MusicPlayerFavoritesHolder {
    private var repository: MusicPlayerFavoritesRepository? = null

    fun install(repository: MusicPlayerFavoritesRepository) {
        this.repository = repository
    }

    val favoriteIds: StateFlow<Set<String>>
        get() = repository?.favoriteIds ?: MutableStateFlow(emptySet())

    val favoriteTracks: StateFlow<List<EmperyMediaTrack>>
        get() = repository?.favoriteTracks ?: MutableStateFlow(emptyList())

    val loading: StateFlow<Boolean>
        get() = repository?.loading ?: MutableStateFlow(false)

    suspend fun refresh() {
        repository?.refresh()
    }

    fun toggleFavorite(trackId: String) {
        repository?.toggleFavorite(trackId)
    }

    fun isFavorite(trackId: String): Boolean = repository?.isFavorite(trackId) == true
}
