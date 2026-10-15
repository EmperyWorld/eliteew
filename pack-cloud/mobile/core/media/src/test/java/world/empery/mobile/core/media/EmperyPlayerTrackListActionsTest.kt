package world.empery.mobile.core.media

import org.junit.Assert.assertEquals
import org.junit.Test

class EmperyPlayerTrackListActionsTest {
    @Test
    fun queueTapOnCurrentIndexTogglesPlayPause() {
        assertEquals(
            EmperyPlayerTrackTapAction.TogglePlayPause,
            resolveQueueTrackTap(tappedIndex = 2, currentQueueIndex = 2),
        )
    }

    @Test
    fun queueTapOnOtherIndexJumps() {
        assertEquals(
            EmperyPlayerTrackTapAction.JumpToQueueIndex,
            resolveQueueTrackTap(tappedIndex = 1, currentQueueIndex = 2),
        )
    }

    @Test
    fun favoriteTapOnCurrentTrackTogglesPlayPause() {
        assertEquals(
            EmperyPlayerTrackTapAction.TogglePlayPause,
            resolveFavoriteTrackTap(tappedTrackId = "a", currentTrackId = "a"),
        )
    }

    @Test
    fun favoriteTapOnOtherTrackPlays() {
        assertEquals(
            EmperyPlayerTrackTapAction.PlayFavoriteTrack,
            resolveFavoriteTrackTap(tappedTrackId = "b", currentTrackId = "a"),
        )
    }
}
