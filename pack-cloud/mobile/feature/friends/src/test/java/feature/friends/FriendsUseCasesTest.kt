/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for each focused Friends use-case family.
 *
 * Invariants:
 * - Assertions target boundary behavior and normalized repository calls.
 *
 * Related:
 * - domain/usecase/
 */
package feature.friends

import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.usecase.FriendDetailUseCase
import feature.friends.domain.usecase.FriendsCirclesUseCase
import feature.friends.domain.usecase.FriendsDeepLinkInput
import feature.friends.domain.usecase.FriendsDeepLinkUseCase
import feature.friends.domain.usecase.FriendsRelationshipReportUseCase
import feature.friends.domain.usecase.FriendsSearchRequestsUseCase
import feature.friends.domain.usecase.FriendsSocialHubUseCase
import feature.friends.domain.usecase.LoadFriendsCacheUseCase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto

class FriendsUseCasesTest {
    @Test
    fun cacheFamilyReadsOverviewAndFriendsOnlyFromCache() = runTest {
        val repository =
            FakeFriendsRepository().apply {
                cachedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("friend-1", "alice", "Alice", null)),
                    )
            }
        val useCase = LoadFriendsCacheUseCase(repository)

        assertSame(repository.cachedOverview, useCase.loadOverview())
        assertEquals("friend-1", useCase.loadFriends().single().id)
        assertEquals(listOf("cacheOverview", "cacheFriends"), repository.calls)
    }

    @Test
    fun searchAndRequestsFamilyNormalizesInputsAndRoutesActions() = runTest {
        val repository =
            FakeFriendsRepository().apply {
                searchResult =
                    listOf(
                        FriendSearchCandidateDto(
                            id = "friend-1",
                            username = "alice",
                            relationship_status = "can_send",
                        ),
                    )
            }
        val useCase = FriendsSearchRequestsUseCase(repository)

        assertEquals("friend-1", useCase.search("  ali  ").single().id)
        useCase.sendByUsername("  alice ")
        useCase.sendToUser(" friend-1 ")
        useCase.accept(" request-1 ")
        useCase.reject(" request-2 ")
        useCase.cancel(" request-3 ")

        assertEquals(
            listOf(
                "search:ali",
                "sendUsername:alice",
                "sendUser:friend-1",
                "accept:request-1",
                "reject:request-2",
                "cancel:request-3",
            ),
            repository.calls,
        )
    }

    @Test
    fun relationshipAndReportFamilyPreservesMutationShape() = runTest {
        val repository = FakeFriendsRepository()
        val useCase = FriendsRelationshipReportUseCase(repository)

        useCase.update(
            userId = " friend-1 ",
            isFavorite = true,
            shareActivityWithFriend = false,
            circleIds = listOf("circle-1"),
            privateNote = "note",
        )
        useCase.report(" friend-1 ", " spam ", " details ")

        assertEquals(
            "relationship:friend-1:true:null:null:false:[circle-1]:note",
            repository.calls[0],
        )
        assertEquals("report:friend-1:spam:details", repository.calls[1])
    }

    @Test
    fun circlesAndSocialHubFamiliesUseDedicatedRepositoryOperations() = runTest {
        val repository =
            FakeFriendsRepository().apply {
                inbox =
                    listOf(
                        SocialHubActionInboxItemDto(
                            id = "inbox-1",
                            type = "friend_request",
                            severity = "attention",
                            title = "Request",
                            summary = "Pending",
                        ),
                    )
            }
        val circles = FriendsCirclesUseCase(repository)
        val social = FriendsSocialHubUseCase(repository)

        assertEquals("Circle", circles.create("  Circle ").name)
        assertEquals("Renamed", circles.rename(" circle-1 ", " Renamed ").name)
        circles.delete(" circle-1 ")
        assertEquals("inbox-1", social.loadInbox().single().id)
        assertEquals("friends", social.loadPrivacyPreview().discoverability)
        assertEquals("code", social.loadReferralInvite().referral_code)
    }

    @Test
    fun friendDetailFamilyLoadsAndSavesWithOverviewRefresh() = runTest {
        val updated = FriendLiteItem("friend-1", "alice", "Alice Updated", null)
        val repository =
            FakeFriendsRepository().apply {
                friendProfile = updated
                relationshipResult = updated
                refreshedOverview =
                    emptyOverview.copy(
                        friends = listOf(updated),
                        circles = listOf(FriendCircleItemDto("circle-1", "Close")),
                    )
                sharedContent =
                    listOf(
                        SocialHubSharedContentItemDto(
                            id = "content-1",
                            direction = "shared_by_friend",
                            shared_reason = "manual",
                            created_at = "2026-07-15T00:00:00Z",
                            updated_at = "2026-07-15T00:00:00Z",
                        ),
                    )
            }
        val useCase = FriendDetailUseCase(repository)

        assertSame(updated, useCase.loadProfile("friend-1"))
        assertEquals("content-1", useCase.loadSharedContent("friend-1").single().id)
        val result = useCase.save("friend-1", "private", listOf("circle-1", "circle-1"))

        assertSame(updated, result.updated)
        assertEquals("circle-1", result.overview.circles.single().id)
        assertEquals("refresh", repository.calls.last())
    }

    @Test
    fun deepLinkFamily_requestFromInboxWinsOverFriendFallback() = runTest {
        val repository =
            FakeFriendsRepository().apply {
                refreshedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("friend-1", "alice", "Alice", null)),
                    )
                inbox =
                    listOf(
                        SocialHubActionInboxItemDto(
                            id = "inbox-1",
                            type = "friend_request",
                            severity = "attention",
                            title = "Request",
                            summary = "Pending",
                            target_tab = "friends",
                            target_id = "request-9",
                        ),
                    )
            }

        val useCase = FriendsDeepLinkUseCase(repository)
        val result =
            useCase(
                FriendsDeepLinkInput(
                    friendRequestId = null,
                    friendUserId = "friend-1",
                    focus = "social_hub",
                    socialHubInboxItemId = "inbox-1",
                ),
            )

        assertEquals("request", result?.focus)
        assertEquals("request-9", result?.requestId)
        assertEquals(null, result?.friendUserId)

        val directConflict =
            useCase(
                FriendsDeepLinkInput(
                    friendRequestId = "request-direct",
                    friendUserId = "friend-1",
                    focus = null,
                    socialHubInboxItemId = null,
                ),
            )
        assertEquals("request", directConflict?.focus)
        assertEquals("request-direct", directConflict?.requestId)
        assertEquals(null, directConflict?.friendUserId)
    }
}
