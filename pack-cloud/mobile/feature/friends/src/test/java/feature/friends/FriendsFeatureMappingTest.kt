package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendUserDto
import world.empery.mobile.core.network.api.SocialHubPrivacyAudiencePreviewDto
import world.empery.mobile.core.network.api.SocialHubPrivacyFieldPreviewDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto

class FriendsFeatureMappingTest {
    @Test
    fun friendOverviewMappingKeepsCircleMembership() {
        val circles =
            listOf(
                FriendCircleItemDto(
                    id = "circle-close",
                    name = "Close",
                    members_count = 2,
                ),
            )

        val friend =
            FriendUserDto(
                id = "friend-1",
                username = "arina",
                full_name = "Arina Friend",
                avatar_url = null,
                circles = circles,
            ).toFriendLiteItem()

        assertEquals(circles, friend.circles)
    }

    @Test
    fun relationshipActionCenterStateMatchesDesktopPriority() {
        val base =
            FriendLiteItem(
                id = "friend-1",
                username = "arina",
                fullName = "Arina Friend",
                avatarUrl = null,
                lastInteractionAt = "2026-05-29T00:00:00Z",
            )

        assertEquals(FriendRelationshipActionCenterState.READY, base.relationshipActionCenterState())
        assertEquals(
            FriendRelationshipActionCenterState.START,
            base.copy(lastInteractionAt = null).relationshipActionCenterState(),
        )
        assertEquals(
            FriendRelationshipActionCenterState.PRIVACY,
            base.copy(shareActivityWithFriend = false).relationshipActionCenterState(),
        )
        assertEquals(
            FriendRelationshipActionCenterState.MUTED,
            base.copy(isMuted = true, shareActivityWithFriend = false).relationshipActionCenterState(),
        )
        assertEquals(
            FriendRelationshipActionCenterState.BLOCKED,
            base.copy(isBlocked = true, isMuted = true).relationshipActionCenterState(),
        )
    }

    @Test
    fun socialHubPrivacyPreviewContractKeepsAudienceFieldsOptional() {
        val preview =
            SocialHubPrivacyPreviewResponseDto(
                discoverability = "hidden",
                fields =
                    mapOf(
                        "avatar" to SocialHubPrivacyFieldPreviewDto(visibility = "everyone"),
                    ),
                audiences =
                    listOf(
                        SocialHubPrivacyAudiencePreviewDto(
                            id = "everyone",
                            label = "Everyone",
                            visible_fields = listOf("avatar"),
                        ),
                    ),
                warnings = listOf("discoverability_hidden"),
            )

        assertEquals("hidden", preview.discoverability)
        assertEquals("everyone", preview.fields["avatar"]?.visibility)
        assertEquals(listOf("avatar"), preview.audiences.single().visible_fields)
    }
}
