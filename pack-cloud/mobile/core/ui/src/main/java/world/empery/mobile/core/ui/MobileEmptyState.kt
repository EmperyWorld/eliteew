/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable empty state with optional next action for tab screens.
 *
 * Invariants:
 * - Uses PremiumStateCard; no data loading.
 *
 * Related:
 * MobileErrorState.kt, FeedFeature.kt, NotificationFeature.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun MobileEmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.AutoAwesome,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    contentDescription: String? = null,
) {
    val cd = contentDescription ?: title
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .semantics(mergeDescendants = true) { this.contentDescription = cd },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(MobileDesignTokens.spacing.xl),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PremiumStateCard(
                modifier = Modifier.fillMaxWidth(),
                title = title,
                message = message,
                icon = icon,
                action =
                    if (actionLabel != null && onAction != null) {
                        {
                            Button(onClick = onAction, modifier = Modifier.mobileMinimumTouchTarget()) {
                                Text(actionLabel)
                            }
                        }
                    } else {
                        null
                    },
            )
        }
    }
}
