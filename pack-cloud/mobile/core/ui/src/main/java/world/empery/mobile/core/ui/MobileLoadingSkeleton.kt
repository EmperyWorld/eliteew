/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loading placeholders for initial tab fetch and inline refresh.
 *
 * Invariants:
 * - Indeterminate progress only; no business logic.
 *
 * Related:
 * PremiumLoadingCard.kt, FeedFeature.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class MobileLoadingSkeletonVariant {
    CARD,
    LIST,
    INLINE,
}

@Composable
fun MobileLoadingSkeleton(
    message: String,
    modifier: Modifier = Modifier,
    variant: MobileLoadingSkeletonVariant = MobileLoadingSkeletonVariant.CARD,
    contentDescription: String? = null,
) {
    val cd = contentDescription ?: message
    when (variant) {
        MobileLoadingSkeletonVariant.CARD ->
            Box(
                modifier =
                    modifier
                        .fillMaxSize()
                        .semantics {
                            this.contentDescription = cd
                            progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
                        },
                contentAlignment = Alignment.Center,
            ) {
                PremiumLoadingCard(
                    message = message,
                    modifier = Modifier.fillMaxWidth().padding(MobileDesignTokens.spacing.xl),
                )
            }

        MobileLoadingSkeletonVariant.LIST ->
            Column(
                modifier =
                    modifier
                        .fillMaxSize()
                        .padding(MobileDesignTokens.spacing.md)
                        .semantics {
                            this.contentDescription = cd
                            progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
                        },
                verticalArrangement = Arrangement.spacedBy(MobileDesignTokens.spacing.sm),
            ) {
                repeat(3) {
                    Surface(
                        modifier = Modifier.fillMaxWidth().height(72.dp).clip(RoundedCornerShape(MobileDesignTokens.radii.md)),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                    ) {}
                }
                PremiumLoadingCard(message = message, modifier = Modifier.fillMaxWidth())
            }

        MobileLoadingSkeletonVariant.INLINE ->
            Column(
                modifier =
                    modifier
                        .fillMaxWidth()
                        .semantics {
                            this.contentDescription = cd
                            progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
                        },
                verticalArrangement = Arrangement.spacedBy(MobileDesignTokens.spacing.xs),
            ) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                PremiumLoadingCard(message = message, modifier = Modifier.fillMaxWidth())
            }
    }
}
