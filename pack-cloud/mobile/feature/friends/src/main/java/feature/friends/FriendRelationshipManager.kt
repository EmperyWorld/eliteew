/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility facade over the Friends relationship/report use case.
 *
 * Related:
 * - domain/usecase/FriendsMutationUseCases.kt
 */
package feature.friends

import feature.friends.domain.usecase.FriendsRelationshipReportUseCase

class FriendRelationshipManager(
    private val useCase: FriendsRelationshipReportUseCase,
) {
    suspend fun updateRelationship(
        userId: String,
        isFavorite: Boolean? = null,
        isMuted: Boolean? = null,
        isBlocked: Boolean? = null,
        shareActivityWithFriend: Boolean? = null,
        circleIds: List<String>? = null,
        privateNote: String? = null,
    ): FriendLiteItem =
        useCase.update(
            userId = userId,
            isFavorite = isFavorite,
            isMuted = isMuted,
            isBlocked = isBlocked,
            shareActivityWithFriend = shareActivityWithFriend,
            circleIds = circleIds,
            privateNote = privateNote,
        )

    suspend fun reportUser(userId: String, reason: String, details: String?) {
        useCase.report(userId, reason, details)
    }
}
