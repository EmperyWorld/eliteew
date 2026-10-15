/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused Friends request/search, relationship/report, and circle use cases.
 *
 * Invariants:
 * - Inputs are normalized before crossing the repository boundary.
 * - Blank mutation identifiers and names are rejected.
 *
 * Related:
 * - feature.friends.domain.FriendsRepository
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto

class FriendsSearchRequestsUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun search(query: String): List<FriendSearchCandidateDto> {
        val normalized = query.trim()
        require(normalized.isNotEmpty()) { "search query must not be blank" }
        return repository.searchUsers(normalized)
    }

    suspend fun sendByUsername(username: String) {
        val normalized = username.trim()
        require(normalized.isNotEmpty()) { "username must not be blank" }
        repository.sendRequest(normalized)
    }

    suspend fun sendToUser(userId: String) {
        repository.sendRequestToUser(userId.requireIdentifier("userId"))
    }

    suspend fun accept(requestId: String) {
        repository.acceptRequest(requestId.requireIdentifier("requestId"))
    }

    suspend fun reject(requestId: String) {
        repository.rejectRequest(requestId.requireIdentifier("requestId"))
    }

    suspend fun cancel(requestId: String) {
        repository.cancelRequest(requestId.requireIdentifier("requestId"))
    }
}

class FriendsRelationshipReportUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun update(
        userId: String,
        isFavorite: Boolean? = null,
        isMuted: Boolean? = null,
        isBlocked: Boolean? = null,
        shareActivityWithFriend: Boolean? = null,
        circleIds: List<String>? = null,
        privateNote: String? = null,
    ): FriendLiteItem =
        repository.updateRelationship(
            userId = userId.requireIdentifier("userId"),
            isFavorite = isFavorite,
            isMuted = isMuted,
            isBlocked = isBlocked,
            shareActivityWithFriend = shareActivityWithFriend,
            circleIds = circleIds,
            privateNote = privateNote,
        )

    suspend fun report(
        userId: String,
        reason: String,
        details: String?,
    ) {
        val normalizedReason = reason.trim()
        require(normalizedReason.isNotEmpty()) { "report reason must not be blank" }
        repository.reportUser(
            userId = userId.requireIdentifier("userId"),
            reason = normalizedReason,
            details = details?.trim()?.takeIf { it.isNotEmpty() },
        )
    }
}

class FriendsCirclesUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun create(name: String): FriendCircleItemDto {
        val normalized = name.trim()
        require(normalized.isNotEmpty()) { "circle name must not be blank" }
        return repository.createCircle(normalized)
    }

    suspend fun rename(
        circleId: String,
        name: String,
    ): FriendCircleItemDto {
        val normalized = name.trim()
        require(normalized.isNotEmpty()) { "circle name must not be blank" }
        return repository.renameCircle(circleId.requireIdentifier("circleId"), normalized)
    }

    suspend fun delete(circleId: String) {
        repository.deleteCircle(circleId.requireIdentifier("circleId"))
    }
}

private fun String.requireIdentifier(name: String): String =
    trim().also { require(it.isNotEmpty()) { "$name must not be blank" } }
