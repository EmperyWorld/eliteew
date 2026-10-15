/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable error state with retry and optional diagnostics-lite line.
 *
 * Invariants:
 * - Diagnostics are display-only; retry is caller-controlled.
 *
 * Related:
 * MobileEmptyState.kt, PremiumStateCard.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow

@Composable
fun MobileErrorState(
    title: String,
    message: String,
    retryLabel: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryEnabled: Boolean = true,
    diagnostics: String? = null,
    icon: ImageVector = Icons.Outlined.ErrorOutline,
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
                isError = true,
                messageContent =
                    if (!diagnostics.isNullOrBlank()) {
                        {
                            Column(verticalArrangement = Arrangement.spacedBy(MobileDesignTokens.spacing.xxs)) {
                                Text(
                                    text = message,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = diagnostics,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    } else {
                        null
                    },
                action = {
                    FilledTonalButton(
                        onClick = onRetry,
                        enabled = retryEnabled,
                        modifier = Modifier.mobileMinimumTouchTarget().semantics { this.contentDescription = retryLabel },
                        colors =
                            ButtonDefaults.filledTonalButtonColors(
                                containerColor = MaterialTheme.colorScheme.error,
                                contentColor = MaterialTheme.colorScheme.onError,
                            ),
                    ) {
                        Text(retryLabel)
                    }
                },
            )
        }
    }
}
