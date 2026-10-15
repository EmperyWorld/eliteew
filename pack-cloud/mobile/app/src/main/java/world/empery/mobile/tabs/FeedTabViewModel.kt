package world.empery.mobile.tabs

import android.app.Application
import androidx.lifecycle.viewModelScope
import feature.feed.FeedTopicFilter
import feature.feed.FeedUiState
import feature.feed.isFeedCacheStale
import feature.feed.parseFeedTopicFilter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileFeatureShellPreferences

class FeedTabViewModel(
    application: Application,
) : AuthenticatedTabViewModel(application) {
    private val appContext = application.applicationContext
    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init {
        _uiState.update {
            it.copy(
                topicFilter = parseFeedTopicFilter(MobileFeatureShellPreferences.getFeedTopicFilter(appContext)),
                savedPostIds = MobileFeatureShellPreferences.getSavedFeedPostIds(appContext),
                cacheStale = isFeedCacheStale(MobileFeatureShellPreferences.getFeedLastSuccessEpochMs(appContext)),
            )
        }
        viewModelScope.launch {
            container.feedRepository.observePosts().collect { posts ->
                _uiState.update { state ->
                    state.copy(
                        posts = posts,
                        cacheStale = isFeedCacheStale(MobileFeatureShellPreferences.getFeedLastSuccessEpochMs(appContext)),
                    )
                }
            }
        }
    }

    fun refresh() = viewModelScope.launch {
        if (!hasSession()) return@launch
        if (_uiState.value.isLoading) return@launch
        _uiState.update { it.copy(isLoading = true, error = null) }
        runCatching { container.feedRepository.refresh() }
            .onSuccess { posts ->
                MobileFeatureShellPreferences.setFeedLastSuccessEpochMs(appContext, System.currentTimeMillis())
                _uiState.update {
                    it.copy(posts = posts, isLoading = false, error = null, cacheStale = false)
                }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshFeed failed")
                val cached = container.feedRepository.loadFromCache()
                _uiState.update {
                    it.copy(posts = cached, isLoading = false, error = err.message)
                }
            }
    }

    /** EWDesk deeplink / push focus: prefetch post and scroll target. */
    fun handleDeepLink(rawPostId: String?) = viewModelScope.launch {
        if (!hasSession()) return@launch
        val postId = MobileDeepLinks.coerceEwDeskPostId(rawPostId)
        postId?.let { id ->
            runCatching { container.feedRepository.fetchAndUpsertNewsPost(id) }
                .onFailure { error ->
                    if (error is CancellationException) throw error
                    MobileTelemetry.reportError(error, "fetchEwDeskNewsPost deeplink=$id failed")
                }
        }
        val posts = container.feedRepository.loadFromCache()
        _uiState.update {
            it.copy(posts = posts, focusPostId = postId)
        }
    }

    fun clearFeedFocus() {
        _uiState.update { it.copy(focusPostId = null) }
    }

    fun setTopicFilter(filter: feature.feed.FeedTopicFilter) {
        MobileFeatureShellPreferences.setFeedTopicFilter(appContext, filter.id)
        _uiState.update { it.copy(topicFilter = filter) }
    }

    fun toggleSavedPost(postId: String) {
        val saved = MobileFeatureShellPreferences.toggleSavedFeedPost(appContext, postId)
        _uiState.update { it.copy(savedPostIds = saved) }
    }

    fun openFullPost(postId: String) {
        _uiState.update { it.copy(fullPostId = postId.trim()) }
    }

    fun dismissFullPost() {
        _uiState.update { it.copy(fullPostId = null) }
    }

    fun dismissOtaChangelog() {
        _uiState.update { it.copy(otaChangelogVersion = null) }
    }

    fun showOtaChangelogIfNeeded(versionName: String) {
        val seen = MobileFeatureShellPreferences.getOtaChangelogSeenVersion(appContext)
        if (seen != versionName) {
            _uiState.update { it.copy(otaChangelogVersion = versionName) }
        }
    }

    fun markOtaChangelogSeen(versionName: String) {
        MobileFeatureShellPreferences.setOtaChangelogSeenVersion(appContext, versionName)
        dismissOtaChangelog()
    }
}
