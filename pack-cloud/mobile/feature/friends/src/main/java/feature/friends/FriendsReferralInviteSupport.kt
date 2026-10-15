/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-backed referral invite share payload for Friends tab — no client-fabricated invite URLs.
 *
 * Invariants:
 * - Share text comes from API `share_message` or server `invite_url` only.
 * - Client must not synthesize `?ref=` links or referral codes.
 *
 * Related:
 * - FriendsApiContracts.kt (`GET friends/referral`)
 * - documentation/api/ANDROID-API-CONTRACTS.md
 */
package feature.friends

import android.content.Context
import android.content.Intent
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto

/** Plain-text body for Android share sheet; prefers server `share_message`. */
internal fun FriendReferralInviteResponseDto.referralSharePlainText(): String {
    val message = share_message.trim()
    if (message.isNotBlank()) return message
    return invite_url.trim()
}

internal fun Context.createReferralShareIntent(dto: FriendReferralInviteResponseDto): Intent =
    Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        val subject = dto.inviter_display_name.trim()
        if (subject.isNotBlank()) {
            putExtra(Intent.EXTRA_SUBJECT, subject)
        }
        putExtra(Intent.EXTRA_TEXT, dto.referralSharePlainText())
    }

internal fun Context.launchReferralShareChooser(
    dto: FriendReferralInviteResponseDto,
    chooserTitle: String,
) {
    runCatching {
        startActivity(Intent.createChooser(createReferralShareIntent(dto), chooserTitle))
    }
}
