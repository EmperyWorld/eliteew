/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed chrome: topic filter chips and loading / empty / error states.
 *
 * Invariants:
 * - Same package as FeedFeature; public [EwDeskFeedScreen] API unchanged for nav.
 *
 * Related:
 * - FeedFeature.kt, FeedRoadmapSupport.kt
 */
package feature.feed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Article
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileEmptyState
import world.empery.mobile.core.ui.MobileErrorState
import world.empery.mobile.core.ui.MobileLoadingSkeleton

@Composable
internal fun FeedInitialLoading() {
    val context = LocalContext.current
    MobileLoadingSkeleton(
        message = stringResource(R.string.feed_loading_cd),
        contentDescription = context.getString(R.string.feed_loading_cd),
    )
}

@Composable
internal fun FeedErrorState(
    message: String,
    onRetry: () -> Unit,
    retryEnabled: Boolean,
) {
    val context = LocalContext.current
    MobileErrorState(
        title = stringResource(R.string.feed_error_heading),
        message = message,
        retryLabel = stringResource(R.string.feed_retry),
        onRetry = onRetry,
        retryEnabled = retryEnabled,
        diagnostics = message.take(120),
        icon = Icons.AutoMirrored.Outlined.Article,
        contentDescription = context.getString(R.string.feed_error_heading_cd),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FeedTopicFilterRow(
    selected: FeedTopicFilter,
    isLoading: Boolean,
    useWrappedLayout: Boolean,
    onTopicFilterChange: (FeedTopicFilter) -> Unit,
) {
    val chip: @Composable (FeedTopicFilter) -> Unit = { filter ->
        AssistChip(
            onClick = { onTopicFilterChange(filter) },
            label = {
                Text(
                    feedTopicLabel(filter),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            },
            enabled = !isLoading,
            colors =
                AssistChipDefaults.assistChipColors(
                    containerColor =
                        if (selected == filter) {
                            MaterialTheme.colorScheme.primaryContainer
                        } else {
                            MaterialTheme.colorScheme.surface
                        },
                ),
        )
    }
    if (useWrappedLayout) {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FeedTopicFilter.entries.forEach { filter ->
                chip(filter)
            }
        }
    } else {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            FeedTopicFilter.entries.forEach { filter ->
                item(key = filter.id) {
                    chip(filter)
                }
            }
        }
    }
}

@Composable
internal fun FeedFilteredEmptyState() {
    val context = LocalContext.current
    MobileEmptyState(
        title = stringResource(R.string.feed_filter_empty_title),
        message = stringResource(R.string.feed_filter_empty_body),
        contentDescription = context.getString(R.string.feed_filter_empty_cd),
        icon = Icons.AutoMirrored.Outlined.Article,
    )
}

@Composable
internal fun FeedEmptyState() {
    val context = LocalContext.current
    MobileEmptyState(
        title = stringResource(R.string.feed_screen_title),
        message = stringResource(R.string.feed_empty_body),
        icon = Icons.AutoMirrored.Outlined.Article,
        contentDescription = context.getString(R.string.feed_empty_cd),
    )
}

@Composable
internal fun feedTopicLabel(filter: FeedTopicFilter): String =
    when (filter) {
        FeedTopicFilter.ALL -> stringResource(R.string.feed_topic_all)
        FeedTopicFilter.PRODUCT -> stringResource(R.string.feed_topic_product)
        FeedTopicFilter.RELEASE -> stringResource(R.string.feed_topic_release)
        FeedTopicFilter.SOCIAL -> stringResource(R.string.feed_topic_social)
        FeedTopicFilter.UGS -> stringResource(R.string.feed_topic_ugs)
        FeedTopicFilter.DESKTOP -> stringResource(R.string.feed_topic_desktop)
        FeedTopicFilter.SUPPORT -> stringResource(R.string.feed_topic_support)
    }
