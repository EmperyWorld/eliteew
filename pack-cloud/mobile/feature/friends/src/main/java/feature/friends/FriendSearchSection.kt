/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility facade over the Friends search/request use-case family.
 *
 * Related:
 * - domain/usecase/FriendsMutationUseCases.kt
 */
package feature.friends

import feature.friends.domain.usecase.FriendsSearchRequestsUseCase
import world.empery.mobile.core.network.api.FriendSearchCandidateDto

class FriendSearchSection(
    private val useCase: FriendsSearchRequestsUseCase,
) {
    suspend fun search(query: String): List<FriendSearchCandidateDto> =
        useCase.search(query)

    suspend fun sendRequestToUser(userId: String) {
        useCase.sendToUser(userId)
    }

    suspend fun sendRequestByUsername(username: String) {
        useCase.sendByUsername(username)
    }
}
