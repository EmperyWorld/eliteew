/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Explicit bundle of focused Friends use cases for composition and presentation injection.
 *
 * Invariants:
 * - Every use case is created from the domain repository contract only.
 *
 * Related:
 * - feature.friends.presentation.FriendsTabViewModel
 * - world.empery.mobile.di.AppContainer
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository

data class FriendsUseCases(
    val overview: RefreshFriendsOverviewUseCase,
    val cache: LoadFriendsCacheUseCase,
    val searchRequests: FriendsSearchRequestsUseCase,
    val relationshipReport: FriendsRelationshipReportUseCase,
    val circles: FriendsCirclesUseCase,
    val socialHub: FriendsSocialHubUseCase,
    val friendDetail: FriendDetailUseCase,
    val deepLink: FriendsDeepLinkUseCase,
    val getFriendsList: GetFriendsListUseCase,
    val searchFriends: SearchFriendsUseCase,
    val addFriend: AddFriendUseCase,
    val removeFriend: RemoveFriendUseCase,
    val updateFriendStatus: UpdateFriendStatusUseCase,
    val getFriendCircles: GetFriendCirclesUseCase,
) {
    companion object {
        fun create(repository: FriendsRepository): FriendsUseCases =
            FriendsUseCases(
                overview = RefreshFriendsOverviewUseCase(repository),
                cache = LoadFriendsCacheUseCase(repository),
                searchRequests = FriendsSearchRequestsUseCase(repository),
                relationshipReport = FriendsRelationshipReportUseCase(repository),
                circles = FriendsCirclesUseCase(repository),
                socialHub = FriendsSocialHubUseCase(repository),
                friendDetail = FriendDetailUseCase(repository),
                deepLink = FriendsDeepLinkUseCase(repository),
                getFriendsList = GetFriendsListUseCase(repository),
                searchFriends = SearchFriendsUseCase(repository),
                addFriend = AddFriendUseCase(repository),
                removeFriend = RemoveFriendUseCase(repository),
                updateFriendStatus = UpdateFriendStatusUseCase(repository),
                getFriendCircles = GetFriendCirclesUseCase(repository),
            )
    }
}
