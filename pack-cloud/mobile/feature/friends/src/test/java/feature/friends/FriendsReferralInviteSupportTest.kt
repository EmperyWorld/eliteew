package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto

class FriendsReferralInviteSupportTest {
    @Test
    fun sharePlainTextPrefersServerShareMessage() {
        val dto =
            FriendReferralInviteResponseDto(
                referral_code = "ABCDEFGH23",
                invite_url = "https://app.eliteew.ru/mobile-app/?ref=ABCDEFGH23",
                inviter_display_name = "Арина",
                share_message = "Арина приглашает вас в EliteEW.",
            )

        assertEquals("Арина приглашает вас в EliteEW.", dto.referralSharePlainText())
    }

    @Test
    fun sharePlainTextFallsBackToServerInviteUrlOnly() {
        val inviteUrl = "https://app.eliteew.ru/mobile-app/?ref=ZYXWVUTSRQ"
        val dto =
            FriendReferralInviteResponseDto(
                referral_code = "ZYXWVUTSRQ",
                invite_url = inviteUrl,
                inviter_display_name = "Арина",
                share_message = "   ",
            )

        assertEquals(inviteUrl, dto.referralSharePlainText())
    }
}
