/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Room integration locks for Friends ETag 304 reuse and network-failure cache fallback.
 */
package feature.friends

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import feature.friends.data.DefaultFriendsRepository
import feature.friends.domain.usecase.RefreshFriendsOverviewUseCase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.core.network.FriendsOverviewRemoteResult
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.network.api.FriendUserDto
import world.empery.mobile.core.network.api.FriendsOverviewResponse
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.friendsDaoBundle

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class FriendsEtagCacheTest {
    private lateinit var database: MobileDatabase
    private lateinit var remote: FakeFriendsRemoteDataSource
    private lateinit var repository: DefaultFriendsRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database =
            Room.inMemoryDatabaseBuilder(context, MobileDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        remote = FakeFriendsRemoteDataSource()
        repository = DefaultFriendsRepository(remote, friendsDaoBundle(database))
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun freshOverviewThen304_returnsCompleteRoomSnapshotAndSendsEtag() = runTest {
        val overview =
            FriendsOverviewResponse(
                friends = listOf(FriendUserDto("friend-1", "alice", "Alice", null)),
                incoming_requests = listOf(FriendRequestDto("incoming-1", from_user_id = "friend-2")),
                sent_requests = listOf(FriendRequestDto("sent-1", to_user_id = "friend-3")),
                circles = listOf(FriendCircleItemDto("circle-1", "Close", members_count = 1)),
            )
        remote.overviewResult =
            FriendsOverviewRemoteResult.Fresh(
                overview = overview,
                etag = "\"friends-overview-v2\"",
            )
        repository.refreshOverview()

        remote.overviewResult = FriendsOverviewRemoteResult.NotModified
        val cached = repository.refreshOverview()

        assertEquals("\"friends-overview-v2\"", remote.lastIfNoneMatch)
        assertEquals(listOf("friend-1"), cached.friends.map { it.id })
        assertEquals(listOf("incoming-1"), cached.incomingRequests.map { it.id })
        assertEquals(listOf("sent-1"), cached.sentRequests.map { it.id })
        assertEquals(listOf("circle-1"), cached.circles.map { it.id })
    }

    @Test
    fun networkFailure_refreshUseCaseReturnsRoomSnapshotWithFailure() = runTest {
        remote.overviewResult =
            FriendsOverviewRemoteResult.Fresh(
                overview =
                    FriendsOverviewResponse(
                        friends = listOf(FriendUserDto("cached-friend", "cached", "Cached", null)),
                        incoming_requests = emptyList(),
                        sent_requests = emptyList(),
                        circles = listOf(FriendCircleItemDto("cached-circle", "Offline")),
                    ),
                etag = "\"v1\"",
            )
        repository.refreshOverview()
        remote.loadOverviewError = IllegalStateException("network down")

        val result = RefreshFriendsOverviewUseCase(repository)()

        assertEquals("network down", result.refreshFailure?.message)
        assertEquals("cached-friend", result.snapshot.friends.single().id)
        assertEquals("cached-circle", result.snapshot.circles.single().id)
    }

    @Test
    fun relationshipMutationInvalidatesEtag() = runTest {
        remote.overviewResult =
            FriendsOverviewRemoteResult.Fresh(
                overview =
                    FriendsOverviewResponse(
                        friends = emptyList(),
                        incoming_requests = emptyList(),
                        sent_requests = emptyList(),
                    ),
                etag = "\"v1\"",
            )
        repository.refreshOverview()
        // Mutation refresh must not re-learn a stale ETag from a 304 path.
        remote.overviewResult = FriendsOverviewRemoteResult.NotModified
        repository.acceptRequest("request-1")

        repository.refreshOverview()

        assertEquals(null, remote.lastIfNoneMatch)
    }

    @Test
    fun removeFriend_deletesRowFromRoomSsot() = runTest {
        remote.overviewResult =
            FriendsOverviewRemoteResult.Fresh(
                overview =
                    FriendsOverviewResponse(
                        friends =
                            listOf(
                                FriendUserDto("friend-1", "alice", "Alice", null),
                                FriendUserDto("friend-2", "bob", "Bob", null),
                            ),
                        incoming_requests = emptyList(),
                        sent_requests = emptyList(),
                        circles = emptyList(),
                    ),
                etag = "\"v-remove\"",
            )
        repository.refreshOverview()
        assertEquals(listOf("friend-1", "friend-2"), repository.loadFriendsFromCache().map { it.id })

        repository.removeFriend("friend-1")

        assertEquals(listOf("friend-2"), repository.loadFriendsFromCache().map { it.id })
    }
}
