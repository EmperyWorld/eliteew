/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small Compose primitives shared by the Friends overview list.
 *
 * Invariants:
 * - Empty and loading states retain accessibility semantics.
 *
 * Related:
 * - FriendsOverviewContent.kt
 * - FriendsFeature.kt
 */
package feature.friends

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import world.empery.mobile.core.ui.MobileEmptyState
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.ScaledChoiceButton

internal const val LazyContentTypeFriend = "friend_row"
internal const val LazyContentTypeRequest = "incoming_request_row"
internal const val LazyContentTypeSentRequest = "sent_request_row"
internal const val LazyContentTypeCircle = "circle_row"

@Composable
internal fun FriendsSectionTitle(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = modifier.semantics { heading() },
    )
}

@Composable
internal fun FriendsEmptyHint(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    emptySemantics: String,
) {
    MobileEmptyState(
        title = title,
        message = message,
        contentDescription = emptySemantics,
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = emptySemantics
                },
    )
}

@Composable
internal fun FriendsLoadingBlock(
    message: String,
    modifier: Modifier = Modifier,
    loadingSemantics: String,
) {
    PremiumLoadingCard(
        message = message,
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = loadingSemantics
                },
    )
}

@Composable
internal fun CircleFilterButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    icon: ImageVector,
    modifier: Modifier = Modifier,
) {
    ScaledChoiceButton(
        selected = selected,
        onClick = onClick,
        enabled = true,
        label = label,
        icon = icon,
        modifier = modifier,
    )
}
