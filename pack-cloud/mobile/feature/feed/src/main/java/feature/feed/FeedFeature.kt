/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed screen host (Super Roadmap feed-001…008): scaffold, banners, and content wiring.
 *
 * Invariants:
 * - User-visible copy comes from `feature.feed` string resources.
 * - Public [EwDeskFeedScreen] signature preserved for nav / TabHostNavGraph.
 *
 * Related:
 * - FeedUiModels, FeedRepository, FeedChromeSections, FeedPostSections, FeedFullPostScreen
 */
package feature.feed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import okhttp3.OkHttpClient
import world.empery.mobile.core.ui.MobileIconButton
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
fun EwDeskFeedScreen(
    state: FeedUiState,
    focusPostId: String?,
    onFeedFocusConsumed: () -> Unit,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
    onRefresh: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenFullEwDesk: () -> Unit = {},
    onOpenApp: (String) -> Unit,
    unreadNotificationCount: Int = 0,
    onTopicFilterChange: (FeedTopicFilter) -> Unit = {},
    onToggleSavedPost: (String) -> Unit = {},
    onOpenFullPost: (String) -> Unit = {},
    onDismissFullPost: () -> Unit = {},
    onDismissOtaChangelog: () -> Unit = {},
    topContent: (@Composable () -> Unit)? = null,
) {
    val context = LocalContext.current
    state.fullPostId?.let { fullId ->
        state.posts.firstOrNull { it.id == fullId }?.let { post ->
            FeedFullPostScreen(
                post = post,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = authenticatedOkHttpClient,
                onBack = onDismissFullPost,
                onOpenApp = onOpenApp,
            )
            return
        }
    }
    val chrome = rememberMobileScaleChromePolicy()
    val filteredPosts =
        remember(state.posts, state.topicFilter) {
            state.posts.filter { state.topicFilter.matchesPost(it) }
        }
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MobileIconButton(
                onClick = onOpenNotifications,
                contentDescription =
                    if (unreadNotificationCount > 0) {
                        context.getString(R.string.feed_notifications_unread_cd, unreadNotificationCount)
                    } else {
                        context.getString(R.string.feed_notifications_cd)
                    },
            ) {
                BadgedBox(
                    badge = {
                        if (unreadNotificationCount > 0) {
                            Badge {
                                Text(
                                    text =
                                        if (unreadNotificationCount > 99) {
                                            "99+"
                                        } else {
                                            unreadNotificationCount.toString()
                                        },
                                )
                            }
                        }
                    },
                ) {
                    Icon(
                        imageVector = Icons.Filled.Notifications,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        if (state.cacheStale) {
            PremiumStateCard(
                modifier = Modifier.fillMaxWidth(),
                title = stringResource(R.string.feed_stale_banner),
                message = stringResource(R.string.feed_stale_retry_hint),
                isError = false,
                action = {
                    TextButton(onClick = onRefresh) {
                        Text(stringResource(R.string.feed_retry))
                    }
                },
            )
        }
        state.otaChangelogVersion?.let { ver ->
            PremiumStateCard(
                modifier = Modifier.fillMaxWidth(),
                title = stringResource(R.string.feed_ota_changelog_title, ver),
                message = stringResource(R.string.feed_ota_changelog_body),
                isError = false,
                action = {
                    TextButton(onClick = onDismissOtaChangelog) {
                        Text(stringResource(R.string.feed_ota_changelog_dismiss))
                    }
                },
            )
        }
        FeedTopicFilterRow(
            selected = state.topicFilter,
            isLoading = state.isLoading,
            useWrappedLayout = chrome.useWrappedFilterChips,
            onTopicFilterChange = onTopicFilterChange,
        )
        FeedFullEwDeskEntryCard(
            onOpenFullEwDesk = onOpenFullEwDesk,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        Spacer(modifier = Modifier.height(6.dp))
        Box(
            modifier = Modifier.fillMaxWidth().weight(1f),
        ) {
            when {
                state.isLoading && state.posts.isEmpty() && state.error == null -> FeedInitialLoading()
                state.posts.isEmpty() && state.error != null ->
                    FeedErrorState(
                        message = state.error,
                        onRetry = onRefresh,
                        retryEnabled = !state.isLoading,
                    )

                state.posts.isEmpty() -> FeedEmptyState()
                filteredPosts.isEmpty() -> FeedFilteredEmptyState()
                else ->
                    FeedPostListAdaptive(
                        posts = filteredPosts,
                        focusPostId = focusPostId,
                        onFeedFocusConsumed = onFeedFocusConsumed,
                        apiRootUrl = apiRootUrl,
                        authenticatedOkHttpClient = authenticatedOkHttpClient,
                        onOpenApp = onOpenApp,
                        topContent = topContent,
                    )
            }
        }
    }
}
