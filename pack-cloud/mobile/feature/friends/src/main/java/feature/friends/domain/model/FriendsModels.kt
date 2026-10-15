/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends domain snapshots and presentation state shared across use cases and UI.
 *
 * Invariants:
 * - Overview snapshots always carry friends, incoming requests, sent requests, and circles together.
 *
 * Related:
 * - feature.friends.domain.FriendsRepository
 * - feature.friends.presentation.FriendsTabViewModel
 */
package feature.friends.domain.model

import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto

data class FriendsUiState(
    val friends: List<FriendLiteItem> = emptyList(),
    val incomingRequests: List<FriendRequestDto> = emptyList(),
    val sentRequests: List<FriendRequestDto> = emptyList(),
    val circles: List<FriendCircleItemDto> = emptyList(),
    val searchCandidates: List<FriendSearchCandidateDto> = emptyList(),
    val isSearching: Boolean = false,
    val searchError: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val inFlightRequestId: String? = null,
    val actionError: String? = null,
    val selectedFriendProfile: FriendLiteItem? = null,
    val isFriendDetailLoading: Boolean = false,
    val friendDetailError: String? = null,
    val focusedRequestId: String? = null,
    val focusedFriendUserId: String? = null,
    val focusedSocialHubInboxItemId: String? = null,
    val socialHubInbox: List<SocialHubActionInboxItemDto> = emptyList(),
    val socialHubInboxExpanded: Boolean = true,
    val privacyPreview: SocialHubPrivacyPreviewResponseDto? = null,
    val showPrivacyWizard: Boolean = false,
    val useFriendDetailScreen: Boolean = false,
    val friendSharedContent: List<SocialHubSharedContentItemDto> = emptyList(),
    val isFriendSharedContentLoading: Boolean = false,
    val friendSharedContentError: String? = null,
    val referralInvite: FriendReferralInviteResponseDto? = null,
    val isReferralLoading: Boolean = false,
    val referralError: String? = null,
)

data class FriendsOverviewSnapshot(
    val friends: List<FriendLiteItem>,
    val incomingRequests: List<FriendRequestDto>,
    val sentRequests: List<FriendRequestDto>,
    val circles: List<FriendCircleItemDto>,
)

data class FriendLiteItem(
    val id: String,
    val username: String?,
    val fullName: String?,
    val avatarUrl: String?,
    val isFavorite: Boolean = false,
    val isMuted: Boolean = false,
    val isBlocked: Boolean = false,
    val shareActivityWithFriend: Boolean = true,
    val activityVisibleToCurrentUser: Boolean = true,
    val lastActivityAt: String? = null,
    val lastInteractionAt: String? = null,
    val circles: List<FriendCircleItemDto> = emptyList(),
    val privateNote: String? = null,
    val noteUpdatedAt: String? = null,
    val friendshipCreatedAt: String? = null,
)
