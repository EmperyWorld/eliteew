/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps a cached friends overview snapshot into tab UI state when network refresh fails.
 *
 * Invariants:
 * - Hydrates all four overview fields: friends, incoming, sent, circles.
 *
 * Related:
 * - FriendsTabViewModel.refresh, FriendsRepository.loadOverviewFromCache
 */
package feature.friends

fun applyFriendsOverviewCacheToUiState(
    state: FriendsUiState,
    snapshot: FriendsOverviewSnapshot,
    errorMessage: String?,
): FriendsUiState =
    state.copy(
        friends = snapshot.friends,
        incomingRequests = snapshot.incomingRequests,
        sentRequests = snapshot.sentRequests,
        circles = snapshot.circles,
        isLoading = false,
        isReferralLoading = false,
        error = errorMessage,
    )
