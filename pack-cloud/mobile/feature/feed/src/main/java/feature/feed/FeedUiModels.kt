/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed UI state model shared by repository, screen, and FeedTabViewModel.
 *
 * Invariants:
 * - Same package as FeedFeature; public [FeedUiState] / [EwDeskFeedScreen] API unchanged for nav.
 *
 * Related:
 * - FeedFeature.kt, FeedRepository.kt, FeedRoadmapSupport.kt
 */
package feature.feed

import world.empery.mobile.core.storage.FeedPostEntity

data class FeedUiState(
    val posts: List<FeedPostEntity> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    /** EWDesk deeplink scroll target (`GET /news/{id}` row must exist locally). */
    val focusPostId: String? = null,
    /** feed-004 */
    val topicFilter: FeedTopicFilter = FeedTopicFilter.ALL,
    /** feed-002 */
    val savedPostIds: Set<String> = emptySet(),
    /** feed-005 */
    val cacheStale: Boolean = false,
    /** feed-003 */
    val fullPostId: String? = null,
    /** feed-008 */
    val otaChangelogVersion: String? = null,
)
