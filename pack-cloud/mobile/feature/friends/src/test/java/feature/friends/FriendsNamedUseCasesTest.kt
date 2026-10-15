/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for the six canonical Friends DDD named use cases.
 *
 * Invariants:
 * - Assertions target repository boundary calls and input normalization.
 *
 * Related:
 * - FriendsNamedUseCases.kt
 */
package feature.friends

import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.usecase.AddFriendUseCase
import feature.friends.domain.usecase.GetFriendCirclesUseCase
import feature.friends.domain.usecase.GetFriendsListUseCase
import feature.friends.domain.usecase.RemoveFriendUseCase
import feature.friends.domain.usecase.SearchFriendsUseCase
import feature.friends.domain.usecase.UpdateFriendStatusUseCase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto

class FriendsNamedUseCasesTest {
    @Test
    fun getFriendsList_readsCacheOnly() =
        runTest {
            val repository =
                FakeFriendsRepository().apply {
                    cachedOverview =
                        emptyOverview.copy(
                            friends = listOf(FriendLiteItem("f1", "alice", "Alice", null)),
                        )
                }

            val friends = GetFriendsListUseCase(repository)()

            assertEquals(listOf("f1"), friends.map { it.id })
            assertEquals(listOf("cacheFriends"), repository.calls)
        }

    @Test
    fun searchFriends_trimsQueryAndRejectsBlank() =
        runTest {
            val repository =
                FakeFriendsRepository().apply {
                    searchResult =
                        listOf(
                            FriendSearchCandidateDto(
                                id = "f1",
                                username = "alice",
                                relationship_status = "can_send",
                            ),
                        )
                }

            assertEquals("f1", SearchFriendsUseCase(repository)("  alice ").single().id)
            assertEquals(listOf("search:alice"), repository.calls)
            val blankError =
                runCatching { SearchFriendsUseCase(repository)("   ") }.exceptionOrNull()
            assertEquals(true, blankError is IllegalArgumentException)
        }

    @Test
    fun addFriend_routesUsernameAndUserId() =
        runTest {
            val repository = FakeFriendsRepository()
            val useCase = AddFriendUseCase(repository)

            useCase.byUsername("  bob ")
            useCase.byUserId(" user-2 ")

            assertEquals(listOf("sendUsername:bob", "sendUser:user-2"), repository.calls)
        }

    @Test
    fun removeFriend_trimsUserId() =
        runTest {
            val repository = FakeFriendsRepository()
            RemoveFriendUseCase(repository)(" friend-9 ")
            assertEquals(listOf("removeFriend:friend-9"), repository.calls)
        }

    @Test
    fun updateFriendStatus_forwardsNormalizedFlags() =
        runTest {
            val repository = FakeFriendsRepository()
            UpdateFriendStatusUseCase(repository)(
                userId = " friend-1 ",
                isFavorite = true,
                isMuted = false,
            )
            assertEquals(
                "relationship:friend-1:true:false:null:null:[]:null",
                repository.calls.single(),
            )
        }

    @Test
    fun getFriendCircles_fallsBackToCacheOnRefreshFailure() =
        runTest {
            val repository =
                FakeFriendsRepository().apply {
                    refreshError = IllegalStateException("offline")
                    cachedOverview =
                        emptyOverview.copy(
                            circles = listOf(FriendCircleItemDto("c1", "Close", members_count = 1)),
                        )
                }

            val circles = GetFriendCirclesUseCase(repository)()

            assertEquals(listOf("c1"), circles.map { it.id })
            assertEquals(listOf("refresh", "cacheOverview"), repository.calls)
        }
}
