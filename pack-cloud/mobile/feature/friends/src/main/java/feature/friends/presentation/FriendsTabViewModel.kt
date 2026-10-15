/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends-owned AndroidX ViewModel for Social Hub state, mutations, and deep-link focus.
 *
 * Invariants:
 * - Session-denied work never crosses a use-case boundary.
 * - Only one request/relationship mutation may be in flight.
 * - Refresh failures retain Room-backed overview data and expose the network error.
 * - Refresh paints Room overview immediately when present, then refreshes network in parallel with social hub extras.
 *
 * Related:
 * - feature.friends.domain.usecase.FriendsUseCases
 * - FriendsPresentationBoundaries.kt
 */
package feature.friends.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import feature.friends.FriendLiteItem
import feature.friends.FriendsUiState
import feature.friends.applyFriendsOverviewCacheToUiState
import feature.friends.domain.usecase.FriendsDeepLinkInput
import feature.friends.domain.usecase.FriendsUseCases
import feature.friends.targetFocus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto

class FriendsTabViewModel(
    private val useCases: FriendsUseCases,
    private val sessionAccess: FriendsSessionAccess,
    private val errorReporter: FriendsErrorReporter,
    private val uiPreferences: FriendsUiPreferences,
) : ViewModel() {
    private val _uiState = MutableStateFlow(FriendsUiState())
    val uiState: StateFlow<FriendsUiState> = _uiState.asStateFlow()

    fun refresh() =
        viewModelScope.launch {
            if (!sessionAccess.hasSession() || _uiState.value.isLoading) return@launch
            val cachedOverview = captureOptional { useCases.cache.loadOverview() }.getOrNull()
            if (cachedOverview != null && !cachedOverview.isEffectivelyEmpty()) {
                _uiState.update {
                    applyFriendsOverviewCacheToUiState(
                        state = it,
                        snapshot = cachedOverview,
                        errorMessage = null,
                    ).copy(isLoading = true, isReferralLoading = true, error = null)
                }
            } else {
                _uiState.update { it.copy(isLoading = true, error = null, isReferralLoading = true) }
            }
            try {
                val result = useCases.overview()
                val refreshFailure = result.refreshFailure
                if (refreshFailure != null) {
                    errorReporter.report(refreshFailure, "refreshFriends failed")
                    _uiState.update {
                        applyFriendsOverviewCacheToUiState(
                            state = it,
                            snapshot = result.snapshot,
                            errorMessage = refreshFailure.message,
                        )
                    }
                    return@launch
                }
                val social =
                    coroutineScope {
                        val inboxDeferred = async { captureOptional { useCases.socialHub.loadInbox() } }
                        val privacyDeferred =
                            async { captureOptional { useCases.socialHub.loadPrivacyPreview() } }
                        val referralDeferred =
                            async { captureOptional { useCases.socialHub.loadReferralInvite() } }
                        Triple(inboxDeferred.await(), privacyDeferred.await(), referralDeferred.await())
                    }
                val inboxResult = social.first
                val privacyResult = social.second
                val referralResult = social.third
                reportOptionalFailure(inboxResult, "refreshFriends.inbox failed")
                reportOptionalFailure(privacyResult, "refreshFriends.privacy failed")
                reportOptionalFailure(referralResult, "refreshFriends.referral failed")
                _uiState.update {
                    it.copy(
                        friends = result.snapshot.friends,
                        incomingRequests = result.snapshot.incomingRequests,
                        sentRequests = result.snapshot.sentRequests,
                        circles = result.snapshot.circles,
                        socialHubInbox = inboxResult.getOrNull().orEmpty(),
                        socialHubInboxExpanded = uiPreferences.isSocialHubInboxExpanded(),
                        privacyPreview = privacyResult.getOrNull(),
                        referralInvite = referralResult.getOrNull() ?: it.referralInvite,
                        isReferralLoading = false,
                        referralError = referralResult.exceptionOrNull()?.message,
                        isLoading = false,
                        error = null,
                    )
                }
            } catch (error: Throwable) {
                handleRefreshFailure(error)
            }
        }

    fun handleDeepLink(
        friendRequestId: String?,
        friendUserId: String?,
        focus: String?,
        socialHubInboxItemId: String? = null,
    ) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession()) return@launch
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val result =
                    useCases.deepLink(
                        FriendsDeepLinkInput(
                            friendRequestId = friendRequestId,
                            friendUserId = friendUserId,
                            focus = focus,
                            socialHubInboxItemId = socialHubInboxItemId,
                        ),
                    )
                if (result == null) {
                    _uiState.update { it.copy(isLoading = false) }
                    return@launch
                }
                result.inboxFailure?.let { errorReporter.report(it, "friendsDeepLink.inbox failed") }
                result.privacyFailure?.let { errorReporter.report(it, "friendsDeepLink.privacy failed") }
                val focusedFriend =
                    result.friendUserId?.let { id ->
                        result.overview.friends.firstOrNull { friend -> friend.id == id }
                    }
                _uiState.update {
                    it.copy(
                        friends = result.overview.friends,
                        incomingRequests = result.overview.incomingRequests,
                        sentRequests = result.overview.sentRequests,
                        circles = result.overview.circles,
                        socialHubInbox = result.inbox,
                        socialHubInboxExpanded =
                            result.focus in setOf("incoming", "social_hub") || it.socialHubInboxExpanded,
                        privacyPreview = result.privacyPreview ?: it.privacyPreview,
                        isLoading = false,
                        error = null,
                        focusedRequestId =
                            result.requestId?.takeIf {
                                result.focus == "request" || result.focus == "incoming"
                            },
                        focusedFriendUserId =
                            result.friendUserId?.takeIf { result.focus == "friend_detail" },
                        focusedSocialHubInboxItemId =
                            result.socialHubInboxItemId?.takeIf { result.focus == "social_hub" },
                        selectedFriendProfile = focusedFriend ?: it.selectedFriendProfile,
                        isFriendDetailLoading = result.focus == "friend_detail" && focusedFriend != null,
                        friendDetailError = null,
                    )
                }
                if (result.focus == "friend_detail" && focusedFriend != null) {
                    loadFriendDetail(focusedFriend)
                }
            } catch (error: Throwable) {
                rethrowCancellation(error)
                errorReporter.report(error, "friendsDeepLink.refresh failed")
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = error.message,
                    )
                }
            }
        }

    fun consumeFocusedSocialHubInboxItem() {
        _uiState.update { it.copy(focusedSocialHubInboxItemId = null) }
    }

    fun sendFriendRequest(username: String) =
        launchRequestMutation("sending", "sendFriendRequest failed") {
            useCases.addFriend.byUsername(username)
        }

    fun searchFriendUsers(query: String) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession()) return@launch
            val trimmed = query.trim()
            if (trimmed.isBlank() || _uiState.value.isSearching) return@launch
            _uiState.update { it.copy(isSearching = true, searchError = null) }
            try {
                val candidates = useCases.searchFriends(trimmed)
                _uiState.update {
                    it.copy(
                        searchCandidates = candidates,
                        isSearching = false,
                    )
                }
            } catch (error: Throwable) {
                rethrowCancellation(error)
                errorReporter.report(error, "searchFriendUsers failed")
                _uiState.update { it.copy(isSearching = false, searchError = error.message) }
            }
        }

    fun sendFriendRequestToUser(userId: String) =
        launchRequestMutation(userId, "sendFriendRequestToUser failed") {
            useCases.addFriend.byUserId(userId)
        }

    fun acceptFriendRequest(requestId: String) =
        launchRequestMutation(requestId, "acceptFriendRequest failed") {
            useCases.searchRequests.accept(requestId)
        }

    fun rejectFriendRequest(requestId: String) =
        launchRequestMutation(requestId, "rejectFriendRequest failed") {
            useCases.searchRequests.reject(requestId)
        }

    fun cancelFriendRequest(requestId: String) =
        launchRequestMutation(requestId, "cancelFriendRequest failed") {
            useCases.searchRequests.cancel(requestId)
        }

    fun removeFriend(friend: FriendLiteItem) =
        launchRelationshipMutation(friend, "removeFriend") {
            useCases.removeFriend(friend.id)
        }

    fun toggleFavorite(friend: FriendLiteItem) =
        launchRelationshipMutation(friend, "toggleFavorite") {
            useCases.updateFriendStatus(
                userId = friend.id,
                isFavorite = !friend.isFavorite,
            )
        }

    fun toggleMute(friend: FriendLiteItem) =
        launchRelationshipMutation(friend, "toggleMute") {
            useCases.updateFriendStatus(
                userId = friend.id,
                isMuted = !friend.isMuted,
            )
        }

    fun toggleShareActivity(friend: FriendLiteItem) =
        launchRelationshipMutation(friend, "toggleShareActivity") {
            useCases.updateFriendStatus(
                userId = friend.id,
                shareActivityWithFriend = !friend.shareActivityWithFriend,
            )
        }

    fun toggleBlock(friend: FriendLiteItem) =
        launchRelationshipMutation(friend, "toggleBlock") {
            useCases.updateFriendStatus(
                userId = friend.id,
                isBlocked = !friend.isBlocked,
            )
        }

    fun reportUser(
        friend: FriendLiteItem,
        reason: String,
        details: String?,
    ) =
        launchRelationshipMutation(friend, "reportUser") {
            useCases.relationshipReport.report(friend.id, reason, details)
        }

    fun toggleSocialHubInboxExpanded() {
        val next = !_uiState.value.socialHubInboxExpanded
        uiPreferences.setSocialHubInboxExpanded(next)
        _uiState.update { it.copy(socialHubInboxExpanded = next) }
    }

    fun expandSocialHubInbox() {
        if (_uiState.value.socialHubInboxExpanded) return
        uiPreferences.setSocialHubInboxExpanded(true)
        _uiState.update { it.copy(socialHubInboxExpanded = true) }
    }

    fun onSocialHubInboxItemClick(item: SocialHubActionInboxItemDto) {
        item.targetFocus()?.let { focus ->
            handleDeepLink(focus.requestId, focus.friendUserId, "social_hub", item.id)
        }
    }

    fun showPrivacyWizard() =
        viewModelScope.launch {
            if (!sessionAccess.hasSession()) return@launch
            if (_uiState.value.privacyPreview != null) {
                _uiState.update { it.copy(showPrivacyWizard = true) }
                return@launch
            }
            try {
                val preview = useCases.socialHub.loadPrivacyPreview()
                _uiState.update { it.copy(privacyPreview = preview, showPrivacyWizard = true) }
            } catch (error: Throwable) {
                handleActionFailure(error, "showPrivacyWizard failed")
            }
        }

    fun dismissPrivacyWizard() {
        _uiState.update { it.copy(showPrivacyWizard = false) }
    }

    fun loadReferralInvite() =
        viewModelScope.launch {
            if (!sessionAccess.hasSession() || _uiState.value.isReferralLoading) return@launch
            _uiState.update { it.copy(isReferralLoading = true, referralError = null) }
            try {
                val invite = useCases.socialHub.loadReferralInvite()
                _uiState.update {
                    it.copy(
                        referralInvite = invite,
                        isReferralLoading = false,
                        referralError = null,
                    )
                }
            } catch (error: Throwable) {
                rethrowCancellation(error)
                errorReporter.report(error, "loadReferralInvite failed")
                _uiState.update {
                    it.copy(
                        isReferralLoading = false,
                        referralError = error.message,
                    )
                }
            }
        }

    fun createCircle(name: String) =
        launchCircleMutation("createCircle failed") {
            useCases.circles.create(name)
        }

    fun deleteCircle(circleId: String) =
        launchCircleMutation("deleteCircle failed") {
            useCases.circles.delete(circleId)
        }

    fun renameCircle(
        circleId: String,
        name: String,
    ) =
        launchCircleMutation("renameCircle failed") {
            useCases.circles.rename(circleId, name)
        }

    fun openFriendDetail(friend: FriendLiteItem) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession()) return@launch
            _uiState.update {
                it.copy(
                    selectedFriendProfile = friend,
                    isFriendDetailLoading = true,
                    friendDetailError = null,
                    friendSharedContent = emptyList(),
                    isFriendSharedContentLoading = true,
                    friendSharedContentError = null,
                    useFriendDetailScreen = true,
                )
            }
            loadFriendDetail(friend)
            loadFriendSharedContent(friend.id)
        }

    fun loadFriendSharedContent(userId: String) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession()) return@launch
            _uiState.update {
                it.copy(
                    isFriendSharedContentLoading = true,
                    friendSharedContentError = null,
                )
            }
            try {
                val items = useCases.friendDetail.loadSharedContent(userId)
                _uiState.update {
                    it.copy(
                        friendSharedContent = items,
                        isFriendSharedContentLoading = false,
                        friendSharedContentError = null,
                    )
                }
            } catch (error: Throwable) {
                rethrowCancellation(error)
                errorReporter.report(error, "friendsRelationship.loadFriendSharedContent failed")
                _uiState.update {
                    it.copy(
                        isFriendSharedContentLoading = false,
                        friendSharedContentError = error.message,
                    )
                }
            }
        }

    fun retryFriendSharedContent() {
        val userId = _uiState.value.selectedFriendProfile?.id ?: return
        loadFriendSharedContent(userId)
    }

    fun dismissFriendDetail() {
        _uiState.update {
            it.copy(
                selectedFriendProfile = null,
                isFriendDetailLoading = false,
                friendDetailError = null,
                friendSharedContent = emptyList(),
                isFriendSharedContentLoading = false,
                friendSharedContentError = null,
                useFriendDetailScreen = false,
            )
        }
    }

    fun saveFriendDetail(
        friend: FriendLiteItem,
        privateNote: String,
        circleIds: List<String>,
    ) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession() || _uiState.value.inFlightRequestId != null) return@launch
            _uiState.update {
                it.copy(
                    inFlightRequestId = friend.id,
                    actionError = null,
                    friendDetailError = null,
                )
            }
            try {
                val result = useCases.friendDetail.save(friend.id, privateNote, circleIds)
                _uiState.update {
                    it.copy(
                        friends = replaceFriend(result.overview.friends, result.updated),
                        incomingRequests = result.overview.incomingRequests,
                        sentRequests = result.overview.sentRequests,
                        circles = result.overview.circles,
                        selectedFriendProfile = result.updated,
                        inFlightRequestId = null,
                        isFriendDetailLoading = false,
                    )
                }
            } catch (error: Throwable) {
                rethrowCancellation(error)
                errorReporter.report(error, "friendsRelationship.saveFriendDetail failed")
                _uiState.update {
                    it.copy(
                        inFlightRequestId = null,
                        friendDetailError = error.message,
                    )
                }
            }
        }

    private fun launchRequestMutation(
        mutationId: String,
        errorContext: String,
        action: suspend () -> Unit,
    ) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession() || _uiState.value.inFlightRequestId != null) return@launch
            _uiState.update { it.copy(inFlightRequestId = mutationId, actionError = null) }
            try {
                action()
                _uiState.update { it.copy(inFlightRequestId = null) }
                refresh()
            } catch (error: Throwable) {
                handleMutationFailure(error, errorContext)
            }
        }

    private fun launchRelationshipMutation(
        friend: FriendLiteItem,
        actionName: String,
        action: suspend () -> Unit,
    ) =
        launchRequestMutation(friend.id, "friendsRelationship.$actionName failed", action)

    private fun launchCircleMutation(
        errorContext: String,
        action: suspend () -> Unit,
    ) =
        viewModelScope.launch {
            if (!sessionAccess.hasSession() || _uiState.value.inFlightRequestId != null) return@launch
            _uiState.update { it.copy(inFlightRequestId = CIRCLE_MUTATION_ID, actionError = null) }
            try {
                action()
                _uiState.update { it.copy(inFlightRequestId = null) }
                refresh()
            } catch (error: Throwable) {
                handleMutationFailure(error, errorContext)
            }
        }

    private suspend fun loadFriendDetail(friend: FriendLiteItem) {
        try {
            val profile = useCases.friendDetail.loadProfile(friend.id)
            _uiState.update {
                it.copy(
                    friends = replaceFriend(it.friends, profile),
                    selectedFriendProfile = profile,
                    isFriendDetailLoading = false,
                    focusedFriendUserId = profile.id,
                )
            }
        } catch (error: Throwable) {
            rethrowCancellation(error)
            errorReporter.report(error, "friendsRelationship.openFriendDetail failed")
            _uiState.update {
                it.copy(
                    isFriendDetailLoading = false,
                    friendDetailError = error.message,
                )
            }
        }
    }

    private suspend fun handleRefreshFailure(error: Throwable) {
        rethrowCancellation(error)
        errorReporter.report(error, "refreshFriends failed")
        val cachedResult = captureOptional { useCases.cache.loadOverview() }
        val cached = cachedResult.getOrNull()
        if (cached != null) {
            _uiState.update {
                applyFriendsOverviewCacheToUiState(it, cached, error.message)
            }
        } else {
            cachedResult.exceptionOrNull()?.let {
                errorReporter.report(it, "refreshFriends.cache failed")
            }
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isReferralLoading = false,
                    error = error.message,
                )
            }
        }
    }

    private fun handleMutationFailure(
        error: Throwable,
        context: String,
    ) {
        rethrowCancellation(error)
        errorReporter.report(error, context)
        _uiState.update { it.copy(inFlightRequestId = null, actionError = error.message) }
    }

    private fun handleActionFailure(
        error: Throwable,
        context: String,
    ) {
        rethrowCancellation(error)
        errorReporter.report(error, context)
        _uiState.update { it.copy(actionError = error.message) }
    }

    private fun replaceFriend(
        friends: List<FriendLiteItem>,
        updated: FriendLiteItem,
    ): List<FriendLiteItem> = friends.map { if (it.id == updated.id) updated else it }

    private suspend fun <T> captureOptional(block: suspend () -> T): Result<T> =
        try {
            Result.success(block())
        } catch (error: Throwable) {
            rethrowCancellation(error)
            Result.failure(error)
        }

    private fun <T> reportOptionalFailure(
        result: Result<T>,
        context: String,
    ) {
        result.exceptionOrNull()?.let { errorReporter.report(it, context) }
    }

    private fun rethrowCancellation(error: Throwable) {
        if (error is CancellationException || error.cause is CancellationException) throw error
    }

    private fun feature.friends.domain.model.FriendsOverviewSnapshot.isEffectivelyEmpty(): Boolean =
        friends.isEmpty() &&
            incomingRequests.isEmpty() &&
            sentRequests.isEmpty() &&
            circles.isEmpty()

    private companion object {
        const val CIRCLE_MUTATION_ID = "circle"
    }
}

class FriendsTabViewModelFactory(
    private val useCases: FriendsUseCases,
    private val sessionAccess: FriendsSessionAccess,
    private val errorReporter: FriendsErrorReporter,
    private val uiPreferences: FriendsUiPreferences,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(FriendsTabViewModel::class.java)) {
            "Unsupported ViewModel: ${modelClass.name}"
        }
        @Suppress("UNCHECKED_CAST")
        return FriendsTabViewModel(
            useCases = useCases,
            sessionAccess = sessionAccess,
            errorReporter = errorReporter,
            uiPreferences = uiPreferences,
        ) as T
    }
}
