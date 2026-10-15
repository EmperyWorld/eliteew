/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends repository implementation: RemoteDataSource ↔ LocalDataSource (Room SSOT).
 *
 * Invariants:
 * - Overview UI snapshots are always read back from Room after a successful network write.
 * - 304 Not Modified returns the complete Room overview without overwriting it.
 * - Mutations that change membership invalidate the overview ETag and sync local state.
 *
 * Related:
 * - FriendsLocalDataSource, FriendsRemoteDataSource, FriendCirclesProvider
 */
package feature.friends.data

import android.util.Log
import feature.friends.domain.FriendsCacheInvalidator
import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import feature.friends.toFriendLiteItem
import kotlinx.coroutines.CancellationException
import world.empery.mobile.core.network.FriendCirclesProvider
import world.empery.mobile.core.network.FriendsOverviewRemoteResult
import world.empery.mobile.core.network.FriendsRemoteDataSource
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRelationshipUpdateBodyDto
import world.empery.mobile.core.network.api.FriendReportBodyDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.storage.FriendsDaoBundle

class DefaultFriendsRepository(
    private val remote: FriendsRemoteDataSource,
    localBundle: FriendsDaoBundle,
    private val local: FriendsLocalDataSource = RoomFriendsLocalDataSource(localBundle),
) : FriendsRepository,
    FriendsCacheInvalidator,
    FriendCirclesProvider {
    private val overviewEtagCache = FriendsOverviewEtagCache()

    override suspend fun loadFriendsFromCache(): List<FriendLiteItem> = loadOverviewFromCache().friends

    override suspend fun loadOverviewFromCache(): FriendsOverviewSnapshot = local.loadOverview()

    override suspend fun refreshOverview(): FriendsOverviewSnapshot =
        when (val result = remote.loadOverview(overviewEtagCache.etag)) {
            FriendsOverviewRemoteResult.NotModified -> loadOverviewFromCache()
            is FriendsOverviewRemoteResult.Fresh -> {
                overviewEtagCache.remember(result.etag)
                val overview = result.overview
                val friends = overview.friends.map { it.toFriendLiteItem() }
                local.replaceOverview(
                    friends = friends,
                    incomingRequests = overview.incoming_requests,
                    sentRequests = overview.sent_requests,
                    circles = overview.circles,
                )
                // SSOT: UI observes Room, never the raw Retrofit payload.
                loadOverviewFromCache()
            }
        }

    override suspend fun acceptRequest(requestId: String) {
        remote.acceptRequest(requestId)
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
    }

    override suspend fun rejectRequest(requestId: String) {
        remote.rejectRequest(requestId)
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
    }

    override suspend fun cancelRequest(requestId: String) {
        remote.cancelRequest(requestId)
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
    }

    override suspend fun sendRequest(username: String) {
        remote.sendRequest(username)
        overviewEtagCache.invalidate()
    }

    override suspend fun searchUsers(query: String): List<FriendSearchCandidateDto> =
        remote.searchUsers(query)

    override suspend fun sendRequestToUser(userId: String) {
        remote.sendRequestToUser(userId)
        overviewEtagCache.invalidate()
    }

    override suspend fun getFriendProfile(userId: String): FriendLiteItem =
        remote.getFriendProfile(userId).toFriendLiteItem()

    override suspend fun updateRelationship(
        userId: String,
        isFavorite: Boolean?,
        isMuted: Boolean?,
        isBlocked: Boolean?,
        shareActivityWithFriend: Boolean?,
        circleIds: List<String>?,
        privateNote: String?,
    ): FriendLiteItem {
        val updated =
            remote.updateRelationship(
                userId = userId,
                body =
                    FriendRelationshipUpdateBodyDto(
                        is_favorite = isFavorite,
                        is_muted = isMuted,
                        is_blocked = isBlocked,
                        share_activity_with_friend = shareActivityWithFriend,
                        circle_ids = circleIds,
                        private_note = privateNote,
                    ),
            ).toFriendLiteItem()
        overviewEtagCache.invalidate()
        return updated
    }

    override suspend fun reportUser(
        userId: String,
        reason: String,
        details: String?,
    ) {
        remote.reportUser(userId, FriendReportBodyDto(reason = reason, details = details))
        overviewEtagCache.invalidate()
    }

    override suspend fun loadSocialHubInbox(): List<SocialHubActionInboxItemDto> =
        remote.loadSocialHubInbox()

    override suspend fun loadFriendSharedContent(userId: String): List<SocialHubSharedContentItemDto> =
        remote.loadFriendSharedContent(userId)

    override suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto =
        remote.loadPrivacyPreview()

    override suspend fun loadReferralInvite(): FriendReferralInviteResponseDto =
        remote.loadReferralInvite()

    override suspend fun createCircle(name: String): FriendCircleItemDto {
        val created = remote.createCircle(name.trim())
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
        return created
    }

    override suspend fun deleteCircle(circleId: String) {
        remote.deleteCircle(circleId)
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
    }

    override suspend fun renameCircle(
        circleId: String,
        name: String,
    ): FriendCircleItemDto {
        val updated = remote.renameCircle(circleId, name.trim())
        overviewEtagCache.invalidate()
        runCatching { refreshOverview() }
        return updated
    }

    override suspend fun removeFriend(userId: String) {
        remote.removeFriend(userId)
        overviewEtagCache.invalidate()
        local.deleteFriend(userId)
    }

    override suspend fun loadFriendCircles(): List<FriendCircleItemDto> =
        try {
            refreshOverview().circles
        } catch (error: Throwable) {
            if (error is CancellationException) throw error
            val cached = loadOverviewFromCache().circles
            if (cached.isEmpty()) throw error
            Log.w(TAG, "friends circles refresh failed; using Room cache", error)
            cached
        }

    override fun invalidateOverviewCache() {
        overviewEtagCache.invalidate()
    }

    private class FriendsOverviewEtagCache {
        var etag: String? = null
            private set

        fun remember(value: String?) {
            if (!value.isNullOrBlank()) {
                etag = value
            }
        }

        fun invalidate() {
            etag = null
        }
    }

    private companion object {
        const val TAG = "FriendsRepository"
    }
}
