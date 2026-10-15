/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary Friends-hub CTA into the nested Social Hub relationship action center.
 *
 * Invariants:
 * - Single primary open action (no competing CTAs on the card).
 *
 * Related:
 * - FriendsRelationshipActionCenterScreen.kt, FriendsOverviewContent.kt
 */
package feature.friends

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import world.empery.mobile.core.ui.PremiumSectionCard

@Composable
internal fun FriendsActionCenterEntryCard(
    attentionCount: Int,
    inboxActionCount: Int,
    onOpenActionCenter: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val openCd = stringResource(R.string.friends_action_center_open_cd)
    PremiumSectionCard(
        title = stringResource(R.string.friends_relationship_action_center_title),
        subtitle =
            stringResource(
                R.string.friends_relationship_action_center_subtitle,
                attentionCount,
                inboxActionCount,
            ),
        icon = Icons.Outlined.Hub,
        modifier = modifier,
    ) {
        Button(
            onClick = onOpenActionCenter,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = openCd },
        ) {
            Text(stringResource(R.string.friends_action_center_open))
        }
    }
}
