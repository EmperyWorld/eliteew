/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * friends-012: push focus mapping for request row, friend detail, social hub inbox targets.
 */
package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto

class FriendsPushFocusTest {
    @Test
    fun resolveRequestFocusFromPushPayload() {
        val target =
            resolveFriendsPushFocus(
                focus = "request",
                friendRequestId = "req-1",
                friendUserId = null,
                inboxItemId = null,
            )
        assertEquals("req-1", target.requestId)
    }

    @Test
    fun sortIncomingHighlightsFocusedRequest() {
        val sorted =
            sortIncomingForPushFocus(
                listOf(
                    FriendRequestDto(id = "a", username = "a"),
                    FriendRequestDto(id = "b", username = "b"),
                ),
                focusedRequestId = "b",
            )
        assertEquals("b", sorted.first().id)
    }

    @Test
    fun resolveIncomingFocusFromInboxTab() {
        val target =
            resolveFriendsPushFocus(
                focus = "incoming",
                friendRequestId = null,
                friendUserId = null,
                inboxItemId = null,
            )
        assertEquals(null, target.requestId)
        assertEquals(null, target.friendUserId)
    }

    @Test
    fun socialHubInboxMapsFriendRequestTarget() {
        val item =
            SocialHubActionInboxItemDto(
                id = "inbox-1",
                type = "friend_request",
                severity = "attention",
                title = "Requests",
                summary = "1 pending",
                target_tab = "friends",
                target_id = "req-9",
            )
        assertEquals("req-9", item.targetFocus()?.requestId)
    }

    @Test
    fun resolveFriendsDeepLinkFocus_socialHubInboxItem() {
        val focus =
            resolveFriendsDeepLinkFocus(
                focus = "social_hub",
                pushFocus = FriendsPushFocusTarget(socialHubInboxItemId = "inbox-42"),
            )
        assertEquals("social_hub", focus)
    }
}
