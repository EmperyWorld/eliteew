/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared NavHost route helpers for tab host: education cards rail and pull-to-refresh
 * route wrapper. Extracted with TabHostNavGraph (W1 slice #4).
 *
 * Invariants:
 * - Visual/behavior parity with pre-split TabHostCoordinator helpers.
 * - Package remains [world.empery.mobile].
 *
 * Related:
 * - TabHostNavGraph.kt, TabHostNav*Routes.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md §0 Hardened residual
 */
package world.empery.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.education.MobileEducationCard
import world.empery.mobile.education.MobileEducationCardId

@Composable
internal fun MobileEducationCardsRail(
    cards: List<MobileEducationCard>,
    onAction: (MobileEducationCardId) -> Unit,
    onDismiss: (MobileEducationCardId) -> Unit,
) {
    if (cards.isEmpty()) return

    PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.education_rail_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        cards.forEach { card ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.64f),
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = stringResource(card.titleRes),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = stringResource(card.bodyRes),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(onClick = { onDismiss(card.id) }) {
                            Text(stringResource(R.string.education_rail_dismiss))
                        }
                        card.actionLabelRes?.let { actionLabelRes ->
                            TextButton(onClick = { onAction(card.id) }) {
                                Text(stringResource(actionLabelRes))
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
internal fun RefreshableRoute(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    content: @Composable () -> Unit,
) {
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = onRefresh,
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pullRefresh(pullRefreshState),
    ) {
        content()
        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
        )
    }
}

