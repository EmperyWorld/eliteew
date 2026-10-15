/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure GAF video call UI state transitions (MA-02.3): State + Event → State + Effects.
 *
 * Invariants:
 * - No I/O, Context, repository, or coroutine calls.
 *
 * Related:
 * - GafVideoCallCoordinator, MainViewModel
 */
package feature.chat.videocall

import feature.chat.GafGroupCallPickerUi
import feature.chat.IncomingGafVideoCallUi
import feature.chat.OutgoingGafVideoCallUi

/** Side effects executed by [GafVideoCallCoordinator] or MainViewModel host after reduce. */
sealed class GafVideoCallEffect {
    data object PauseMedia : GafVideoCallEffect()

    data object SyncForegroundService : GafVideoCallEffect()

    data object EnsureRealtimeConnected : GafVideoCallEffect()

    data object NavigateToChatTab : GafVideoCallEffect()

    data object CancelOutgoingJoinPoll : GafVideoCallEffect()

    data class StartOutgoingJoinPoll(
        val callId: String,
        val chatId: String?,
        val title: String,
    ) : GafVideoCallEffect()

    data class FinishMeetWebView(val callId: String) : GafVideoCallEffect()

    data class EndCallOnServer(val callId: String) : GafVideoCallEffect()

    data class ShowMissedCallToast(val missedReason: String) : GafVideoCallEffect()

    data class ScheduleChatRefresh(val delayMs: Long) : GafVideoCallEffect()

    data class OpenChat(val chatId: String) : GafVideoCallEffect()

    data class ShowIncomingCallAlert(
        val callId: String,
        val chatId: String?,
        val title: String,
        val callerUserId: String?,
        val callerAvatarUrl: String?,
        val callKind: String?,
    ) : GafVideoCallEffect()

    /** Stop FGS ringtone (IncomingCallRingtoneService) when UI leaves ringing. */
    data class StopIncomingRingtone(val callId: String) : GafVideoCallEffect()
}

data class GafVideoCallState(
    val overlay: GafVideoCallOverlayUi? = null,
    val incoming: IncomingGafVideoCallUi? = null,
    val outgoing: OutgoingGafVideoCallUi? = null,
    val groupPicker: GafGroupCallPickerUi? = null,
) {
    fun hasActiveSession(): Boolean = overlay != null || incoming != null || outgoing != null
}

data class GafVideoCallReduceResult(
    val state: GafVideoCallState,
    val effects: List<GafVideoCallEffect> = emptyList(),
    val skipped: Boolean = false,
)

object GafVideoCallStateReducer {
    fun shouldAcceptIncoming(
        state: GafVideoCallState,
        callId: String,
    ): Boolean {
        if (callId.isBlank()) return false
        if (state.overlay?.callId == callId) return false
        if (state.incoming?.callId == callId) return false
        return true
    }

    fun reduceSetIncoming(
        state: GafVideoCallState,
        incoming: IncomingGafVideoCallUi,
        appInForeground: Boolean,
    ): GafVideoCallReduceResult {
        if (!shouldAcceptIncoming(state, incoming.callId)) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        val effects = mutableListOf<GafVideoCallEffect>(
            GafVideoCallEffect.PauseMedia,
            GafVideoCallEffect.SyncForegroundService,
            GafVideoCallEffect.EnsureRealtimeConnected,
            GafVideoCallEffect.NavigateToChatTab,
        )
        if (!appInForeground) {
            effects +=
                GafVideoCallEffect.ShowIncomingCallAlert(
                    callId = incoming.callId,
                    chatId = incoming.chatId,
                    title = incoming.title,
                    callerUserId = incoming.callerUserId,
                    callerAvatarUrl = incoming.participants.firstOrNull()?.avatarUrl,
                    callKind = if (incoming.isGroupCall) "group" else null,
                )
        }
        return GafVideoCallReduceResult(
            state = state.copy(incoming = incoming),
            effects = effects,
        )
    }

    fun reduceSetOutgoingAwaiting(
        state: GafVideoCallState,
        outgoing: OutgoingGafVideoCallUi,
    ): GafVideoCallReduceResult =
        GafVideoCallReduceResult(
            state = state.copy(outgoing = outgoing),
            effects =
                listOf(
                    GafVideoCallEffect.PauseMedia,
                    GafVideoCallEffect.StartOutgoingJoinPoll(
                        callId = outgoing.callId,
                        chatId = outgoing.chatId,
                        title = outgoing.title,
                    ),
                    GafVideoCallEffect.SyncForegroundService,
                    GafVideoCallEffect.EnsureRealtimeConnected,
                ),
        )

    fun reduceSetActiveOverlay(
        state: GafVideoCallState,
        overlay: GafVideoCallOverlayUi,
        fromOutgoing: Boolean = false,
    ): GafVideoCallReduceResult {
        val effects = mutableListOf<GafVideoCallEffect>(
            GafVideoCallEffect.SyncForegroundService,
            GafVideoCallEffect.EnsureRealtimeConnected,
        )
        if (fromOutgoing) {
            effects.add(0, GafVideoCallEffect.CancelOutgoingJoinPoll)
        }
        return GafVideoCallReduceResult(
            state =
                state.copy(
                    overlay = overlay,
                    outgoing = if (fromOutgoing) null else state.outgoing,
                ),
            effects = effects,
        )
    }

    fun reduceApplyJoinOverlay(
        state: GafVideoCallState,
        overlay: GafVideoCallOverlayUi,
    ): GafVideoCallReduceResult =
        GafVideoCallReduceResult(
            state =
                state.copy(
                    overlay = overlay,
                    outgoing = null,
                ),
            effects =
                listOf(
                    GafVideoCallEffect.CancelOutgoingJoinPoll,
                    GafVideoCallEffect.SyncForegroundService,
                ),
        )

    fun reduceAcceptIncoming(state: GafVideoCallState): GafVideoCallReduceResult? {
        val pending = state.incoming ?: return null
        return GafVideoCallReduceResult(
            state = state.copy(incoming = null),
            effects =
                listOf(
                    GafVideoCallEffect.StopIncomingRingtone(pending.callId),
                    GafVideoCallEffect.PauseMedia,
                ),
        )
    }

    fun reduceDeclineIncoming(state: GafVideoCallState): GafVideoCallReduceResult? {
        val pending = state.incoming ?: return null
        return GafVideoCallReduceResult(
            state = state.copy(incoming = null),
            effects =
                listOf(
                    GafVideoCallEffect.StopIncomingRingtone(pending.callId),
                    GafVideoCallEffect.SyncForegroundService,
                    GafVideoCallEffect.EndCallOnServer(pending.callId),
                ),
        )
    }

    fun reduceCancelOutgoing(state: GafVideoCallState): GafVideoCallReduceResult? {
        val pending = state.outgoing ?: return null
        return GafVideoCallReduceResult(
            state = state.copy(outgoing = null),
            effects =
                listOf(
                    GafVideoCallEffect.CancelOutgoingJoinPoll,
                    GafVideoCallEffect.EndCallOnServer(pending.callId),
                ),
        )
    }

    fun reduceEndActive(state: GafVideoCallState): GafVideoCallReduceResult? {
        val active = state.overlay ?: return null
        return GafVideoCallReduceResult(
            state = state.copy(overlay = null),
            effects =
                listOf(
                    GafVideoCallEffect.SyncForegroundService,
                    GafVideoCallEffect.FinishMeetWebView(active.callId),
                    GafVideoCallEffect.EndCallOnServer(active.callId),
                ),
        )
    }

    fun reduceRemoteEnded(
        state: GafVideoCallState,
        callId: String,
        missedReason: String?,
        status: String?,
    ): GafVideoCallReduceResult {
        if (callId.isBlank()) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        var next = state
        val effects = mutableListOf<GafVideoCallEffect>()
        if (next.incoming?.callId == callId) {
            next = next.copy(incoming = null)
            effects += GafVideoCallEffect.StopIncomingRingtone(callId)
        }
        if (next.outgoing?.callId == callId) {
            next = next.copy(outgoing = null)
            effects += GafVideoCallEffect.CancelOutgoingJoinPoll
            if (status == "missed" && !missedReason.isNullOrBlank()) {
                effects += GafVideoCallEffect.ShowMissedCallToast(missedReason)
            }
        }
        if (next.overlay?.callId == callId) {
            next = next.copy(overlay = null)
            effects += GafVideoCallEffect.SyncForegroundService
            effects += GafVideoCallEffect.FinishMeetWebView(callId)
        }
        if (next == state && effects.isEmpty()) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = next, effects = effects)
    }

    fun reduceRemoteAccepted(
        state: GafVideoCallState,
        callId: String,
    ): GafVideoCallReduceResult {
        if (callId.isBlank()) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        var next = state
        val effects = mutableListOf<GafVideoCallEffect>()
        val matchedOutgoing = state.outgoing?.takeIf { it.callId == callId }
        val matchedIncoming = state.incoming?.takeIf { it.callId == callId }
        if (matchedOutgoing != null) {
            next = next.copy(outgoing = null)
            effects += GafVideoCallEffect.CancelOutgoingJoinPoll
        }
        if (matchedIncoming != null) {
            next = next.copy(incoming = null)
            effects += GafVideoCallEffect.StopIncomingRingtone(callId)
        }
        if (next == state && effects.isEmpty()) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = next, effects = effects)
    }

    fun reduceWebViewEnded(
        state: GafVideoCallState,
        callId: String,
        chatId: String?,
        chatQuickRefreshMs: Long,
        selectedChatId: String?,
    ): GafVideoCallReduceResult {
        val effects = mutableListOf<GafVideoCallEffect>()
        var next = state
        if (next.overlay?.callId == callId) {
            next = next.copy(overlay = null)
            effects += GafVideoCallEffect.SyncForegroundService
        }
        if (!chatId.isNullOrBlank()) {
            effects += GafVideoCallEffect.ScheduleChatRefresh(chatQuickRefreshMs)
            if (selectedChatId == chatId) {
                effects += GafVideoCallEffect.OpenChat(chatId)
            }
        }
        return GafVideoCallReduceResult(state = next, effects = effects)
    }

    fun reduceClearStaleBeforeNew(
        state: GafVideoCallState,
        keepCallIds: Set<String>,
    ): GafVideoCallReduceResult {
        val effects = mutableListOf<GafVideoCallEffect>()
        var next = state
        next.overlay?.let { active ->
            if (active.callId !in keepCallIds) {
                next = next.copy(overlay = null)
                effects += GafVideoCallEffect.SyncForegroundService
                effects += GafVideoCallEffect.FinishMeetWebView(active.callId)
                effects += GafVideoCallEffect.EndCallOnServer(active.callId)
            }
        }
        next.outgoing?.let { outgoing ->
            if (outgoing.callId !in keepCallIds) {
                next = next.copy(outgoing = null)
                effects += GafVideoCallEffect.CancelOutgoingJoinPoll
                effects += GafVideoCallEffect.SyncForegroundService
                effects += GafVideoCallEffect.EndCallOnServer(outgoing.callId)
            }
        }
        if (next == state && effects.isEmpty()) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = next, effects = effects)
    }

    fun reduceLogoutReset(): GafVideoCallReduceResult =
        GafVideoCallReduceResult(
            state = GafVideoCallState(),
            effects =
                listOf(
                    GafVideoCallEffect.CancelOutgoingJoinPoll,
                    GafVideoCallEffect.StopIncomingRingtone(""),
                ),
        )

    fun reduceOpenGroupPicker(
        state: GafVideoCallState,
        picker: GafGroupCallPickerUi,
    ): GafVideoCallReduceResult = GafVideoCallReduceResult(state = state.copy(groupPicker = picker))

    fun reduceDismissGroupPicker(state: GafVideoCallState): GafVideoCallReduceResult =
        GafVideoCallReduceResult(state = state.copy(groupPicker = null))

    fun reduceGroupPickerSubmitting(
        state: GafVideoCallState,
        chatId: String,
    ): GafVideoCallReduceResult {
        val current = state.groupPicker ?: return GafVideoCallReduceResult(state = state, skipped = true)
        if (current.chatId != chatId) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = state.copy(groupPicker = current.copy(isSubmitting = true)))
    }

    fun reduceGroupPickerSubmitFailed(
        state: GafVideoCallState,
        chatId: String,
    ): GafVideoCallReduceResult {
        val current = state.groupPicker ?: return GafVideoCallReduceResult(state = state, skipped = true)
        if (current.chatId != chatId) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = state.copy(groupPicker = current.copy(isSubmitting = false)))
    }

    fun reduceGroupCallActive(
        state: GafVideoCallState,
        overlay: GafVideoCallOverlayUi,
    ): GafVideoCallReduceResult =
        GafVideoCallReduceResult(
            state =
                state.copy(
                    groupPicker = null,
                    overlay = overlay,
                ),
            effects =
                listOf(
                    GafVideoCallEffect.PauseMedia,
                    GafVideoCallEffect.SyncForegroundService,
                    GafVideoCallEffect.EnsureRealtimeConnected,
                ),
        )

    fun reduceUpdateGroupPicker(
        state: GafVideoCallState,
        chatId: String,
        transform: (GafGroupCallPickerUi) -> GafGroupCallPickerUi,
    ): GafVideoCallReduceResult {
        val current = state.groupPicker ?: return GafVideoCallReduceResult(state = state, skipped = true)
        if (current.chatId != chatId) {
            return GafVideoCallReduceResult(state = state, skipped = true)
        }
        return GafVideoCallReduceResult(state = state.copy(groupPicker = transform(current)))
    }
}
