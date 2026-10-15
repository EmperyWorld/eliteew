/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact quick actions for Friends tab — inbox and privacy without duplicate metric cards.
 *
 * Invariants:
 * - Does not duplicate hero metrics; only actionable shortcuts.
 *
 * Related:
 * - FriendsFeature.kt, FriendsScreenChrome.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.ScaledOutlinedButton

@Composable
internal fun FriendsTabQuickActions(
    inboxActionCount: Int,
    onOpenInbox: () -> Unit,
    onOpenPrivacy: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ScaledOutlinedButton(
            onClick = onOpenInbox,
            label =
                if (inboxActionCount > 0) {
                    stringResource(R.string.friends_quick_inbox_with_count, inboxActionCount)
                } else {
                    stringResource(R.string.friends_quick_inbox)
                },
            icon = Icons.Outlined.Inbox,
            enabled = true,
            modifier = Modifier.weight(1f),
        )
        ScaledOutlinedButton(
            onClick = onOpenPrivacy,
            label = stringResource(R.string.friends_quick_privacy),
            icon = Icons.Outlined.Shield,
            enabled = true,
            modifier = Modifier.weight(1f),
        )
    }
}
