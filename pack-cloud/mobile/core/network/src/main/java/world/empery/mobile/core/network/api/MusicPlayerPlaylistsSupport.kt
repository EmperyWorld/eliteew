/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize desktop shell_state music_playlists with the web Music Player favorites playlist.
 *
 * Invariants:
 * - Favorites playlist id matches web/desktop API (`eliteew-music-favorites`).
 * - Favorites row is always first after normalization.
 *
 * Related:
 * - DesktopApiContracts.kt, MusicPlayerFavoritesRepository.kt, musicPlayerTypes.ts
 */
package world.empery.mobile.core.network.api

const val MUSIC_FAVORITES_PLAYLIST_ID = "eliteew-music-favorites"

const val MUSIC_FAVORITES_PLAYLIST_CANONICAL_NAME = "Любимые"

data class MusicSavedPlaylist(
    val id: String,
    val name: String,
    val trackIds: List<String>,
)

fun shellMusicPlaylistsToSaved(raw: List<DesktopMusicPlaylistDto>): List<MusicSavedPlaylist> {
    val mapped =
        raw.mapNotNull { dto ->
            val id = dto.id.trim()
            if (id.isEmpty()) return@mapNotNull null
            MusicSavedPlaylist(
                id = id,
                name = dto.name.trim(),
                trackIds = dto.track_ids.map { it.trim() }.filter { it.isNotEmpty() }.distinct(),
            )
        }
    return normalizeMusicPlaylistsWithFavorites(mapped)
}

fun normalizeMusicPlaylistsWithFavorites(
    playlists: List<MusicSavedPlaylist>,
): List<MusicSavedPlaylist> {
    val deduped = LinkedHashMap<String, MusicSavedPlaylist>()
    for (playlist in playlists) {
        val existing = deduped[playlist.id]
        if (existing == null) {
            deduped[playlist.id] = playlist
        } else {
            deduped[playlist.id] =
                existing.copy(
                    name = playlist.name.ifBlank { existing.name },
                    trackIds = (existing.trackIds + playlist.trackIds).distinct(),
                )
        }
    }
    val list = deduped.values.toMutableList()
    var favIndex = list.indexOfFirst { it.id == MUSIC_FAVORITES_PLAYLIST_ID }
    if (favIndex == -1) {
        list.add(
            0,
            MusicSavedPlaylist(
                id = MUSIC_FAVORITES_PLAYLIST_ID,
                name = MUSIC_FAVORITES_PLAYLIST_CANONICAL_NAME,
                trackIds = emptyList(),
            ),
        )
    } else if (favIndex > 0) {
        val fav = list.removeAt(favIndex)
        list.add(0, fav)
    }
    val favorites = list.first()
    list[0] =
        favorites.copy(
            name = MUSIC_FAVORITES_PLAYLIST_CANONICAL_NAME,
            trackIds = favorites.trackIds.distinct(),
        )
    return list
}

fun savedMusicPlaylistsToShellPatch(playlists: List<MusicSavedPlaylist>): List<DesktopMusicPlaylistDto> =
    normalizeMusicPlaylistsWithFavorites(playlists).map { playlist ->
        DesktopMusicPlaylistDto(
            id = playlist.id,
            name = playlist.name,
            track_ids = playlist.trackIds,
        )
    }

fun favoriteTrackIdsFromPlaylists(playlists: List<MusicSavedPlaylist>): List<String> =
    playlists.firstOrNull { it.id == MUSIC_FAVORITES_PLAYLIST_ID }?.trackIds.orEmpty()
