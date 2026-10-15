/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve incoming GAF call participant display name and avatar from local chat/friends cache.
 *
 * Invariants:
 * - Best-effort only; never blocks incoming-call UX on network.
 *
 * Related:
 * - IncomingGafCallWakeActivity, MainViewModel.resolveIncomingGafVideoCall
 */
package world.empery.mobile.push

import feature.chat.IncomingCallParticipantUi
import feature.chat.IncomingGafVideoCallUi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.di.AppContainer
import feature.friends.FriendLiteItem
import world.empery.mobile.observability.MobileTelemetry

object IncomingCallLocalResolver {
    suspend fun resolve(
        container: AppContainer,
        callId: String,
        chatId: String?,
        callerUserId: String?,
        callKind: String?,
        participantUserIds: List<String>,
        fallbackTitle: String?,
        fallbackAvatarUrl: String?,
        inMemoryChats: List<ChatEntity> = emptyList(),
    ): IncomingGafVideoCallUi =
        withContext(Dispatchers.IO) {
            val chats =
                inMemoryChats.ifEmpty {
                    runCatching { container.chatRepository.loadChatListFromCache() }.getOrDefault(emptyList())
                }
            val friends =
                runCatching { container.friendsUseCases.cache.loadFriends() }
                    .onFailure { error ->
                        if (error is CancellationException) throw error
                        MobileTelemetry.reportError(error, "IncomingCallLocalResolver.friendsCache failed")
                    }
                    .getOrDefault(emptyList())
            build(
                chats = chats,
                friends = friends,
                callId = callId,
                chatId = chatId,
                callerUserId = callerUserId,
                callKind = callKind,
                participantUserIds = participantUserIds,
                fallbackTitle = fallbackTitle,
                fallbackAvatarUrl = fallbackAvatarUrl,
            )
        }

    fun build(
        chats: List<ChatEntity>,
        friends: List<FriendLiteItem>,
        callId: String,
        chatId: String?,
        callerUserId: String?,
        callKind: String?,
        participantUserIds: List<String>,
        fallbackTitle: String?,
        fallbackAvatarUrl: String?,
    ): IncomingGafVideoCallUi {
        val chat = chatId?.let { id -> chats.find { it.chatId == id } }

        fun resolveParticipant(userId: String): IncomingCallParticipantUi {
            chats.find { it.partnerId == userId }?.let { match ->
                val name = match.partnerName?.trim().orEmpty().ifBlank { userId.take(8) }
                return IncomingCallParticipantUi(
                    userId = userId,
                    displayName = name,
                    avatarUrl = match.partnerAvatarUrl,
                )
            }
            friends.find { it.id == userId }?.let { friend ->
                val name =
                    friend.fullName?.trim().orEmpty().ifBlank {
                        friend.username?.trim().orEmpty()
                    }.ifBlank { userId.take(8) }
                return IncomingCallParticipantUi(
                    userId = userId,
                    displayName = name,
                    avatarUrl = friend.avatarUrl,
                )
            }
            return IncomingCallParticipantUi(
                userId = userId,
                displayName = userId.take(8),
                avatarUrl = null,
            )
        }

        val normalizedCallerId = callerUserId?.trim()?.takeIf { it.isNotEmpty() }
        val normalizedParticipantIds =
            participantUserIds
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .distinct()
                .ifEmpty {
                    buildList {
                        normalizedCallerId?.let { add(it) }
                        chat?.partnerId?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
                    }.distinct()
                }

        val participants = normalizedParticipantIds.map { resolveParticipant(it) }
        val callerParticipant =
            normalizedCallerId?.let { resolveParticipant(it) }
                ?: participants.firstOrNull()
                ?: chat?.partnerId?.trim()?.takeIf { it.isNotEmpty() }?.let { resolveParticipant(it) }

        val isGroupCall = callKind == "group"
        val title =
            when {
                !fallbackTitle.isNullOrBlank() && participants.isEmpty() && callerParticipant == null -> fallbackTitle
                isGroupCall && participants.size > 1 ->
                    "${callerParticipant?.displayName ?: fallbackTitle ?: "Видеозвонок"} +${participants.size - 1}"
                callerParticipant != null -> callerParticipant.displayName
                chat != null ->
                    chat.partnerName.orEmpty().ifBlank { fallbackTitle ?: "Видеозвонок" }
                else -> fallbackTitle ?: "Видеозвонок"
            }

        var resolvedParticipants =
            when {
                participants.isNotEmpty() -> participants
                callerParticipant != null -> listOf(callerParticipant)
                else -> emptyList()
            }

        if (resolvedParticipants.isEmpty() && chat != null) {
            val partnerId = chat.partnerId?.trim().orEmpty()
            if (partnerId.isNotEmpty()) {
                resolvedParticipants =
                    listOf(
                        IncomingCallParticipantUi(
                            userId = partnerId,
                            displayName = chat.partnerName.orEmpty().ifBlank { fallbackTitle ?: partnerId.take(8) },
                            avatarUrl = chat.partnerAvatarUrl,
                        ),
                    )
            }
        }

        if (!fallbackAvatarUrl.isNullOrBlank() && resolvedParticipants.isNotEmpty()) {
            val primary = resolvedParticipants.first()
            if (primary.avatarUrl.isNullOrBlank()) {
                resolvedParticipants =
                    listOf(primary.copy(avatarUrl = fallbackAvatarUrl)) + resolvedParticipants.drop(1)
            }
        }

        if (resolvedParticipants.isEmpty()) {
            val displayName =
                fallbackTitle?.trim().orEmpty().ifBlank {
                    normalizedCallerId?.take(8) ?: "?"
                }
            if (normalizedCallerId != null || displayName != "?" || !fallbackAvatarUrl.isNullOrBlank()) {
                resolvedParticipants =
                    listOf(
                        IncomingCallParticipantUi(
                            userId = normalizedCallerId ?: "caller",
                            displayName = displayName,
                            avatarUrl = fallbackAvatarUrl,
                        ),
                    )
            }
        }

        return IncomingGafVideoCallUi(
            callId = callId,
            chatId = chatId,
            title = title,
            callerUserId = normalizedCallerId,
            isGroupCall = isGroupCall,
            participants = resolvedParticipants,
        )
    }
}
