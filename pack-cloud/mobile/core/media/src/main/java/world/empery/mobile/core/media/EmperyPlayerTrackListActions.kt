// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Resolves queue/favorite row taps: re-selecting the current track toggles play/pause.
// Invariants:
// - Queue match is by index; favorites match by track id.
// Related:
// - EmperyExpandedPlayerSheet.kt
// ---

package world.empery.mobile.core.media

internal enum class EmperyPlayerTrackTapAction {
    TogglePlayPause,
    JumpToQueueIndex,
    PlayFavoriteTrack,
}

internal fun resolveQueueTrackTap(
    tappedIndex: Int,
    currentQueueIndex: Int,
): EmperyPlayerTrackTapAction =
    if (tappedIndex == currentQueueIndex) {
        EmperyPlayerTrackTapAction.TogglePlayPause
    } else {
        EmperyPlayerTrackTapAction.JumpToQueueIndex
    }

internal fun resolveFavoriteTrackTap(
    tappedTrackId: String,
    currentTrackId: String?,
): EmperyPlayerTrackTapAction =
    if (currentTrackId != null && tappedTrackId == currentTrackId) {
        EmperyPlayerTrackTapAction.TogglePlayPause
    } else {
        EmperyPlayerTrackTapAction.PlayFavoriteTrack
    }

internal fun dispatchPlayerTrackTap(
    action: EmperyPlayerTrackTapAction,
    queueIndex: Int,
    favoriteTrack: EmperyMediaTrack,
    onTogglePlayPause: () -> Unit,
    onJumpToQueueIndex: (Int) -> Unit,
    onPlayFavoriteTrack: (EmperyMediaTrack) -> Unit,
) {
    when (action) {
        EmperyPlayerTrackTapAction.TogglePlayPause -> onTogglePlayPause()
        EmperyPlayerTrackTapAction.JumpToQueueIndex -> onJumpToQueueIndex(queueIndex)
        EmperyPlayerTrackTapAction.PlayFavoriteTrack -> onPlayFavoriteTrack(favoriteTrack)
    }
}
