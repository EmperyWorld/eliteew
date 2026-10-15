/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.core.network.api.FriendsApi
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.network.api.FriendReferralPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubFeedResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentResponseDto

class SocialHubFeedContractsTest {
    private val gson = Gson()

    @Test
    fun socialHubFeedAndSharedContentUseBackendPaths() {
        ApiContractPathAssertions.assertGet(FriendsApi::class, "getSocialHubFeed", "social-hub/feed")
        ApiContractPathAssertions.assertGet(
            FriendsApi::class,
            "getSocialHubSharedContent",
            "social-hub/friends/{friendUserId}/shared-content",
        )
        ApiContractPathAssertions.assertGet(FriendsApi::class, "getFriendReferralInvite", "friends/referral")
        ApiContractPathAssertions.assertGet(
            FriendsApi::class,
            "previewFriendReferralCode",
            "friends/referral/preview",
        )
    }

    @Test
    fun parsesSocialHubFeedResponse() {
        val json = """
            {
              "items": [
                {
                  "id": "friendship:1",
                  "type": "friendship_created",
                  "created_at": "2026-05-29T00:00:00+00:00",
                  "actor_user_id": "friend-user",
                  "target_user_id": "current-user",
                  "username": "friend",
                  "full_name": "Friend User",
                  "avatar_url": null,
                  "summary": "Friendship established"
                }
              ],
              "next_cursor": null
            }
        """.trimIndent()
        val dto = gson.fromJson(json, SocialHubFeedResponseDto::class.java)
        assertEquals(1, dto.items.size)
        assertEquals("friendship_created", dto.items.first().type)
        assertNull(dto.next_cursor)
    }

    @Test
    fun parsesSharedContentResponse() {
        val json = """
            {
              "items": [
                {
                  "id": "content-1",
                  "name": "notes.pdf",
                  "title": "Notes",
                  "content_type": "document",
                  "mime_type": "application/pdf",
                  "file_size": 1024,
                  "visibility": "friends",
                  "direction": "from_friend",
                  "shared_reason": "direct_share",
                  "created_at": "2026-05-29T00:00:00+00:00",
                  "updated_at": "2026-05-29T01:00:00+00:00",
                  "thumbnail_url": null
                }
              ]
            }
        """.trimIndent()
        val dto = gson.fromJson(json, SocialHubSharedContentResponseDto::class.java)
        assertEquals("from_friend", dto.items.first().direction)
        assertEquals(1024L, dto.items.first().file_size)
    }

    @Test
    fun parsesReferralInviteResponse() {
        val json = """
            {
              "referral_code": "ABCDEFGH23",
              "invite_url": "https://app.eliteew.ru/mobile-app/?ref=ABCDEFGH23",
              "inviter_display_name": "Current User",
              "share_message": "Current User приглашает вас в EliteEW."
            }
        """.trimIndent()
        val dto = gson.fromJson(json, FriendReferralInviteResponseDto::class.java)
        assertEquals("ABCDEFGH23", dto.referral_code)
        assertEquals("Current User", dto.inviter_display_name)
    }

    @Test
    fun parsesReferralPreviewResponse() {
        val json = """
            {
              "valid": true,
              "referral_code": "ABCDEFGH23",
              "inviter_display_name": "Current User",
              "invite_url": "https://app.eliteew.ru/mobile-app/?ref=ABCDEFGH23"
            }
        """.trimIndent()
        val dto = gson.fromJson(json, FriendReferralPreviewResponseDto::class.java)
        assertEquals(true, dto.valid)
        assertEquals("ABCDEFGH23", dto.referral_code)
    }
}
