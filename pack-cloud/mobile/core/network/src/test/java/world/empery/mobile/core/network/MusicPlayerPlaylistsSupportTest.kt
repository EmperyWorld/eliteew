package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.DesktopMusicPlaylistDto
import world.empery.mobile.core.network.api.MUSIC_FAVORITES_PLAYLIST_ID
import world.empery.mobile.core.network.api.MusicSavedPlaylist
import world.empery.mobile.core.network.api.favoriteTrackIdsFromPlaylists
import world.empery.mobile.core.network.api.normalizeMusicPlaylistsWithFavorites
import world.empery.mobile.core.network.api.shellMusicPlaylistsToSaved

class MusicPlayerPlaylistsSupportTest {
    @Test
    fun normalize_insertsFavoritesFirst() {
        val normalized =
            normalizeMusicPlaylistsWithFavorites(
                listOf(
                    MusicSavedPlaylist(id = "custom", name = "Mine", trackIds = listOf("a")),
                ),
            )
        assertEquals(MUSIC_FAVORITES_PLAYLIST_ID, normalized.first().id)
        assertEquals(2, normalized.size)
    }

    @Test
    fun toggleOrder_preservedThroughShellMapping() {
        val raw =
            listOf(
                DesktopMusicPlaylistDto(
                    id = MUSIC_FAVORITES_PLAYLIST_ID,
                    name = "Любимые",
                    track_ids = listOf("one", "two"),
                ),
            )
        val saved = shellMusicPlaylistsToSaved(raw)
        assertEquals(listOf("one", "two"), favoriteTrackIdsFromPlaylists(saved))
    }

    @Test
    fun shellMapping_mergesDuplicatePlaylistIds() {
        val saved =
            shellMusicPlaylistsToSaved(
                listOf(
                    DesktopMusicPlaylistDto(id = "x", name = "A", track_ids = listOf("1")),
                    DesktopMusicPlaylistDto(id = "x", name = "B", track_ids = listOf("2")),
                ),
            )
        val custom = saved.first { it.id == "x" }
        assertTrue(custom.trackIds.containsAll(listOf("1", "2")))
    }
}
