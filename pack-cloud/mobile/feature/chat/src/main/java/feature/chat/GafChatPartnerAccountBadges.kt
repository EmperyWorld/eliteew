/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Partner account badges for GAF chat list rows and thread header (trusted, admin, system, blocked).
 *
 * Invariants:
 * - User-visible badge labels use `feature.chat` string resources.
 *
 * Related:
 * - GafChatListPartnerPresentation.kt, ChatFeature.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumBadge

@Composable
fun GafChatPartnerAccountBadges(
    meta: GafChatListPartnerMeta,
    isSystemAccount: Boolean,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val iconSize = if (compact) 14.dp else 16.dp
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (meta.isTrusted) {
            if (compact) {
                Icon(
                    imageVector = Icons.Outlined.Verified,
                    contentDescription = stringResource(R.string.chat_partner_trusted_cd),
                    modifier = Modifier.size(iconSize),
                    tint = Color(0xFF38BDF8),
                )
            } else {
                PremiumBadge(text = stringResource(R.string.chat_partner_trusted_badge))
            }
        }
        meta.adminBadgeLabel?.trim()?.takeIf { it.isNotEmpty() }?.let { label ->
            PremiumBadge(text = label)
        }
        if (isSystemAccount) {
            Icon(
                imageVector = Icons.Outlined.Memory,
                contentDescription = stringResource(R.string.chat_system_badge_cd),
                modifier = Modifier.size(iconSize),
                tint = Color(0xFFF59E0B),
            )
        }
        if (meta.isPartnerBlocked) {
            Icon(
                imageVector = Icons.Outlined.Block,
                contentDescription = stringResource(R.string.chat_partner_blocked_cd),
                modifier = Modifier.size(iconSize),
                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.88f),
            )
        } else if (meta.blockedByPartner) {
            Icon(
                imageVector = Icons.Outlined.Block,
                contentDescription = stringResource(R.string.chat_partner_blocked_you_cd),
                modifier = Modifier.size(iconSize),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
            )
        }
    }
}
