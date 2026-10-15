/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF video call lifecycle: create/join/end, socket events, outgoing poll, group picker (MA-02.3).
 *
 * Invariants:
 * - State mutations go through GafVideoCallStateReducer; side effects via GafVideoCallHost.
 *
 * Related:
 * - MainViewModel, IncomingCallLocalResolver, RealtimeSocketCoordinator
 */
package world.empery.mobile.shell.videocall

import android.app.Application
import android.util.Log
import android.widget.Toast
import feature.chat.GafGroupCallFriendOption
import feature.chat.GafGroupCallPickerUi
import feature.chat.GafMeetWebViewLauncher
import feature.chat.IncomingGafVideoCallUi
import feature.chat.OutgoingGafVideoCallUi
import feature.chat.videocall.GafVideoCallEffect
import feature.chat.videocall.GafVideoCallOverlayUi
import feature.chat.videocall.GafVideoCallReduceResult
import feature.chat.videocall.GafVideoCallState
import feature.chat.videocall.GafVideoCallStateReducer
import feature.friends.FriendLiteItem
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import world.empery.mobile.R
import world.empery.mobile.core.network.MobileNetworkFailureSupport
import world.empery.mobile.core.network.api.VideoCallJoinResponseDto
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.push.IncomingCallLocalResolver

private const val TAG = "GafVideoCallCoordinator"
private const val OUTGOING_JOIN_POLL_MS = 2_000L

/** Shell hooks for video call side effects; MainViewModel implements. */
interface GafVideoCallHost {
    fun isAuthenticated(): Boolean

    fun currentChats(): List<ChatEntity>

    fun selectedChatId(): String?

    fun isAppInForeground(): Boolean

    fun application(): Application

    fun string(resId: Int): String

    fun string(
        resId: Int,
        vararg args: Any,
    ): String

    fun chatQuickRefreshMs(): Long

    fun onCallSessionChanged()

    fun ensureRealtimeConnected()

    fun navigateToChatTab()

    fun openChat(chatId: String)

    fun scheduleChatRefresh(delayMs: Long)

    fun pauseMediaForGafCall()
}

class GafVideoCallCoordinator(
    private val scope: CoroutineScope,
    private val container: AppContainer,
    private val host: GafVideoCallHost,
) {
    private val _overlay = MutableStateFlow<GafVideoCallOverlayUi?>(null)
    val gafVideoCallOverlay: StateFlow<GafVideoCallOverlayUi?> = _overlay.asStateFlow()

    private val _incoming = MutableStateFlow<IncomingGafVideoCallUi?>(null)
    val incomingGafVideoCall: StateFlow<IncomingGafVideoCallUi?> = _incoming.asStateFlow()

    private val _outgoing = MutableStateFlow<OutgoingGafVideoCallUi?>(null)
    val outgoingGafVideoCall: StateFlow<OutgoingGafVideoCallUi?> = _outgoing.asStateFlow()

    private val _groupPicker = MutableStateFlow<GafGroupCallPickerUi?>(null)
    val gafGroupCallPicker: StateFlow<GafGroupCallPickerUi?> = _groupPicker.asStateFlow()

    private var outgoingJoinPollJob: Job? = null

    private fun snapshotState(): GafVideoCallState =
        GafVideoCallState(
            overlay = _overlay.value,
            incoming = _incoming.value,
            outgoing = _outgoing.value,
            groupPicker = _groupPicker.value,
        )

    private fun applyState(state: GafVideoCallState) {
        _overlay.value = state.overlay
        _incoming.value = state.incoming
        _outgoing.value = state.outgoing
        _groupPicker.value = state.groupPicker
    }

    fun hasActiveCallSession(): Boolean = snapshotState().hasActiveSession()

    fun resetOnLogout() {
        val result = GafVideoCallStateReducer.reduceLogoutReset()
        applyState(result.state)
        applyEffects(result.effects)
    }

    private fun applyReduceResult(result: GafVideoCallReduceResult) {
        if (result.skipped) return
        applyState(result.state)
        applyEffects(result.effects)
    }

    private fun applyEffects(effects: List<GafVideoCallEffect>) {
        effects.forEach { effect ->
            when (effect) {
                GafVideoCallEffect.PauseMedia -> host.pauseMediaForGafCall()
                GafVideoCallEffect.SyncForegroundService -> host.onCallSessionChanged()
                GafVideoCallEffect.EnsureRealtimeConnected -> host.ensureRealtimeConnected()
                GafVideoCallEffect.NavigateToChatTab -> host.navigateToChatTab()
                GafVideoCallEffect.CancelOutgoingJoinPoll -> cancelOutgoingJoinPoll()
                is GafVideoCallEffect.StartOutgoingJoinPoll ->
                    startOutgoingJoinPoll(effect.callId, effect.chatId, effect.title)
                is GafVideoCallEffect.FinishMeetWebView ->
                    GafMeetWebViewLauncher.requestFinish(host.application(), effect.callId)
                is GafVideoCallEffect.EndCallOnServer -> endCallOnServer(effect.callId)
                is GafVideoCallEffect.ShowMissedCallToast -> showMissedCallToast(effect.missedReason)
                is GafVideoCallEffect.ScheduleChatRefresh -> host.scheduleChatRefresh(effect.delayMs)
                is GafVideoCallEffect.OpenChat -> host.openChat(effect.chatId)
                is GafVideoCallEffect.ShowIncomingCallAlert ->
                    world.empery.mobile.push.IncomingCallAlertSupport.showIncomingCallAlert(
                        context = host.application(),
                        callId = effect.callId,
                        chatId = effect.chatId,
                        title = effect.title,
                        callerUserId = effect.callerUserId,
                        callerAvatarUrl = effect.callerAvatarUrl,
                        callKind = effect.callKind,
                    )
                is GafVideoCallEffect.StopIncomingRingtone ->
                    world.empery.mobile.push.IncomingCallRingtoneService.stop(
                        host.application(),
                        effect.callId,
                    )
            }
        }
    }

    private fun endCallOnServer(callId: String) {
        scope.launch(Dispatchers.IO) {
            runCatching { container.chatRepository.endGafVideoCall(callId) }
                .onFailure { err ->
                    if (err is CancellationException) throw err
                    MobileTelemetry.reportError(err, "endGafVideoCall failed callId=$callId")
                }
        }
    }

    private fun showMissedCallToast(missedReason: String) {
        val messageRes =
            when (missedReason) {
                "no_answer" -> feature.chat.R.string.chat_video_call_missed_no_answer
                "callee_unreachable" -> feature.chat.R.string.chat_video_call_missed_unreachable
                "callee_mobile_unreachable" -> feature.chat.R.string.chat_video_call_missed_mobile_unreachable
                "declined" -> feature.chat.R.string.chat_video_call_missed_declined
                "caller_cancelled" -> feature.chat.R.string.chat_video_call_missed_cancelled
                else -> feature.chat.R.string.chat_video_call_missed_generic
            }
        Toast.makeText(host.application(), host.string(messageRes), Toast.LENGTH_LONG).show()
    }

    fun presentIncomingFromPush(
        callId: String,
        chatId: String?,
        title: String,
        autoAccept: Boolean = false,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
    ) {
        if (!host.isAuthenticated() || callId.isBlank()) return
        scope.launch {
            val incoming =
                IncomingCallLocalResolver.resolve(
                    container = container,
                    callId = callId,
                    chatId = chatId,
                    callerUserId = callerUserId,
                    callKind = null,
                    participantUserIds = emptyList(),
                    fallbackTitle = title.ifBlank { host.string(R.string.app_gaf_video_call_default) },
                    fallbackAvatarUrl = callerAvatarUrl,
                    inMemoryChats = host.currentChats(),
                )
            applyReduceResult(
                GafVideoCallStateReducer.reduceSetIncoming(
                    snapshotState(),
                    incoming,
                    appInForeground = host.isAppInForeground(),
                ),
            )
            if (autoAccept) {
                acceptIncoming()
            }
        }
    }

    fun startFromChat(chatId: String) {
        if (chatId.isBlank()) return
        scope.launch {
            if (!host.isAuthenticated()) return@launch
            applyReduceResult(
                GafVideoCallStateReducer.reduceClearStaleBeforeNew(snapshotState(), emptySet()),
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    container.chatRepository.createGafVideoCall(chatId)
                }
            }.onSuccess { response ->
                handleCreateResponse(response, chatId)
            }.onFailure { err ->
                if (err is CancellationException) throw err
                showStartFailedToast(err)
            }
        }
    }

    private fun handleCreateResponse(
        response: VideoCallJoinResponseDto,
        chatId: String,
    ) {
        val title = resolveTitle(chatId, host.string(R.string.app_gaf_video_call_default))
        val joinUrl = response.join_url?.trim().orEmpty()
        if (response.awaiting_accept == true || joinUrl.isBlank()) {
            applyReduceResult(
                GafVideoCallStateReducer.reduceSetOutgoingAwaiting(
                    snapshotState(),
                    OutgoingGafVideoCallUi(
                        callId = response.call_id,
                        chatId = chatId,
                        title = title,
                    ),
                ),
            )
            return
        }
        applyReduceResult(
            GafVideoCallStateReducer.reduceSetActiveOverlay(
                snapshotState(),
                overlayFromDto(response, title, chatId),
            ),
        )
    }

    fun openGroupPicker(chatId: String) {
        if (chatId.isBlank()) return
        val chat = host.currentChats().find { it.chatId == chatId } ?: return
        if (chat.isSystemAccount) return
        val partnerName =
            chat.partnerName.orEmpty().ifBlank { host.string(R.string.app_gaf_video_call_default) }
        applyReduceResult(
            GafVideoCallStateReducer.reduceOpenGroupPicker(
                snapshotState(),
                GafGroupCallPickerUi(
                    chatId = chatId,
                    chatPartnerId = chat.partnerId?.trim()?.ifBlank { null },
                    chatPartnerName = partnerName,
                    friends = emptyList(),
                    isLoading = true,
                ),
            ),
        )
        scope.launch {
            populateGroupPickerFriends(chatId, chat.partnerId?.trim()?.ifBlank { null })
            runCatching {
                withContext(Dispatchers.IO) { container.friendsUseCases.overview() }
            }.onSuccess { result ->
                result.refreshFailure?.let { error ->
                    MobileTelemetry.reportError(error, "gafGroupPicker.friendsRefresh failed")
                }
                populateGroupPickerFriends(
                    chatId,
                    chat.partnerId?.trim()?.ifBlank { null },
                    result.snapshot.friends,
                )
            }.onFailure { error ->
                if (error is CancellationException) throw error
                MobileTelemetry.reportError(error, "gafGroupPicker.friendsRefresh failed")
            }
        }
    }

    fun dismissGroupPicker() {
        applyReduceResult(GafVideoCallStateReducer.reduceDismissGroupPicker(snapshotState()))
    }

    fun startGroupFromChat(
        chatId: String,
        additionalParticipantIds: List<String>,
    ) {
        if (chatId.isBlank() || additionalParticipantIds.isEmpty()) return
        scope.launch {
            applyReduceResult(
                GafVideoCallStateReducer.reduceGroupPickerSubmitting(snapshotState(), chatId),
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    container.chatRepository.createGafGroupVideoCall(
                        chatId,
                        additionalParticipantIds.distinct(),
                    )
                }
            }.onSuccess { response ->
                val partnerName =
                    host.currentChats()
                        .find { it.chatId == chatId }
                        ?.partnerName
                        .orEmpty()
                        .ifBlank { host.string(R.string.app_gaf_video_call_default) }
                val invitedCount = response.invited_user_ids?.size ?: additionalParticipantIds.size
                val title =
                    if (invitedCount > 0) {
                        host.string(R.string.app_gaf_group_video_call_title, partnerName, invitedCount + 1)
                    } else {
                        partnerName
                    }
                applyReduceResult(
                    GafVideoCallStateReducer.reduceGroupCallActive(
                        snapshotState(),
                        overlayFromDto(response, title, chatId),
                    ),
                )
            }.onFailure { err ->
                if (err is CancellationException) throw err
                applyReduceResult(
                    GafVideoCallStateReducer.reduceGroupPickerSubmitFailed(snapshotState(), chatId),
                )
                showStartFailedToast(err)
            }
        }
    }

    fun returnToActiveCall() {
        _overlay.value?.chatId?.let { host.openChat(it) }
    }

    fun onMeetCallEnded(
        callId: String,
        chatId: String?,
        @Suppress("UNUSED_PARAMETER") durationSeconds: Long,
    ) {
        applyReduceResult(
            GafVideoCallStateReducer.reduceWebViewEnded(
                snapshotState(),
                callId = callId,
                chatId = chatId,
                chatQuickRefreshMs = host.chatQuickRefreshMs(),
                selectedChatId = host.selectedChatId(),
            ),
        )
    }

    fun endActive() {
        applyReduceResult(GafVideoCallStateReducer.reduceEndActive(snapshotState()) ?: return)
    }

    fun cancelOutgoing() {
        applyReduceResult(GafVideoCallStateReducer.reduceCancelOutgoing(snapshotState()) ?: return)
    }

    fun acceptIncoming() {
        val pending = _incoming.value ?: return
        val callId = pending.callId
        applyReduceResult(GafVideoCallStateReducer.reduceAcceptIncoming(snapshotState()) ?: return)
        scope.launch {
            if (!host.isAuthenticated()) return@launch
            applyReduceResult(
                GafVideoCallStateReducer.reduceClearStaleBeforeNew(
                    snapshotState(),
                    keepCallIds = setOf(callId),
                ),
            )
            runCatching {
                withContext(Dispatchers.IO) {
                    container.chatRepository.joinGafVideoCall(callId)
                }
            }.onSuccess { response ->
                val joinUrl = response.join_url?.trim().orEmpty()
                if (joinUrl.isBlank()) return@onSuccess
                applyReduceResult(
                    GafVideoCallStateReducer.reduceSetActiveOverlay(
                        snapshotState(),
                        GafVideoCallOverlayUi(
                            callId = callId,
                            joinUrl = joinUrl,
                            meetBaseUrl = response.meet_base_url.orEmpty(),
                            roomName = response.room_name,
                            jwt = response.jwt.orEmpty(),
                            title = pending.title,
                            chatId = pending.chatId,
                        ),
                    ),
                )
            }.onFailure { err ->
                if (err is CancellationException) throw err
                showJoinFailedToast(err)
            }
        }
    }

    fun declineIncoming() {
        applyReduceResult(GafVideoCallStateReducer.reduceDeclineIncoming(snapshotState()) ?: return)
    }

    fun onVideoCallIncoming(payload: JSONObject) {
        val callTarget =
            payload.optString("call_target").ifBlank {
                feature.profile.MobileProfileLocalStore.getCallTarget(host.application())
            }
        if (!feature.profile.VideoCallTarget.shouldRingMobile(callTarget)) {
            return
        }
        val callId = payload.optString("call_id").ifBlank { payload.optString("callId") }
        val chatIdRaw = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val chatId = chatIdRaw.ifBlank { null }
        val callerUserId =
            payload.optString("caller_user_id").ifBlank { payload.optString("callerUserId") }
                .ifBlank { null }
        val callKind = payload.optString("call_kind").ifBlank { null }
        val participantUserIds =
            buildList {
                val arr = payload.optJSONArray("participant_user_ids")
                if (arr != null) {
                    for (index in 0 until arr.length()) {
                        arr.optString(index).trim().takeIf { it.isNotEmpty() }?.let { add(it) }
                    }
                }
            }
        if (callId.isBlank()) return
        if (!GafVideoCallStateReducer.shouldAcceptIncoming(snapshotState(), callId)) return
        scope.launch {
            if (!host.isAuthenticated()) return@launch
            val incoming =
                resolveIncomingGafVideoCall(
                    callId = callId,
                    chatId = chatId,
                    callerUserId = callerUserId,
                    callKind = callKind,
                    participantUserIds = participantUserIds,
                )
            applyReduceResult(
                GafVideoCallStateReducer.reduceSetIncoming(
                    snapshotState(),
                    incoming,
                    appInForeground = host.isAppInForeground(),
                ),
            )
        }
    }

    fun onVideoCallEnded(payload: JSONObject) {
        val callId = payload.optString("call_id").ifBlank { payload.optString("callId") }
        val missedReason =
            payload.optString("missed_reason").ifBlank { payload.optString("missedReason") }
                .ifBlank { null }
        val status = payload.optString("status").ifBlank { null }
        applyReduceResult(
            GafVideoCallStateReducer.reduceRemoteEnded(
                snapshotState(),
                callId = callId,
                missedReason = missedReason,
                status = status,
            ),
        )
    }

    fun onVideoCallAccepted(payload: JSONObject) {
        val callId = payload.optString("call_id").ifBlank { payload.optString("callId") }
        if (callId.isBlank()) return
        val chatIdRaw = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val chatId = chatIdRaw.ifBlank { null }
        val outgoing = _outgoing.value
        val matchedOutgoing = outgoing?.takeIf { it.callId == callId }
        val title =
            matchedOutgoing?.title
                ?: resolveTitle(
                    chatId ?: outgoing?.chatId,
                    host.string(R.string.app_gaf_video_call_default),
                )
        applyReduceResult(GafVideoCallStateReducer.reduceRemoteAccepted(snapshotState(), callId))
        // Device affinity: only the client that placed the outgoing ring joins Meet.
        // Idle phone must not join when desktop called (and vice versa) — dual join flaps media.
        if (matchedOutgoing == null) return
        scope.launch {
            joinCallAndShowOverlay(
                callId = callId,
                chatId = chatId ?: outgoing?.chatId,
                title = title,
            )
        }
    }

    private suspend fun resolveIncomingGafVideoCall(
        callId: String,
        chatId: String?,
        callerUserId: String?,
        callKind: String?,
        participantUserIds: List<String>,
        fallbackTitle: String? = null,
    ): IncomingGafVideoCallUi {
        val resolved =
            IncomingCallLocalResolver.resolve(
                container = container,
                callId = callId,
                chatId = chatId,
                callerUserId = callerUserId,
                callKind = callKind,
                participantUserIds = participantUserIds,
                fallbackTitle = fallbackTitle,
                fallbackAvatarUrl = null,
                inMemoryChats = host.currentChats(),
            )
        if (callKind == "group" && resolved.participants.size > 1) {
            val callerName =
                resolved.participants.firstOrNull()?.displayName
                    ?: host.string(R.string.app_gaf_video_call_default)
            return resolved.copy(
                title =
                    host.string(
                        R.string.app_gaf_group_video_call_title,
                        callerName,
                        resolved.participants.size - 1,
                    ),
            )
        }
        return resolved
    }

    private suspend fun populateGroupPickerFriends(
        chatId: String,
        excludePartnerId: String?,
        friends: List<FriendLiteItem>? = null,
    ) {
        val source =
            friends
                ?: runCatching {
                    withContext(Dispatchers.IO) { container.friendsUseCases.cache.loadFriends() }
                }.onFailure { error ->
                    if (error is CancellationException) throw error
                    MobileTelemetry.reportError(error, "gafGroupPicker.friendsCache failed")
                }.getOrDefault(emptyList())
        applyReduceResult(
            GafVideoCallStateReducer.reduceUpdateGroupPicker(snapshotState(), chatId) { current ->
                current.copy(
                    friends =
                        source
                            .filter { friend -> excludePartnerId == null || friend.id != excludePartnerId }
                            .map { friend ->
                                GafGroupCallFriendOption(
                                    id = friend.id,
                                    displayName =
                                        friend.fullName?.trim()?.ifBlank { null }
                                            ?: friend.username?.trim()?.ifBlank { null }
                                            ?: friend.id,
                                    username = friend.username?.trim()?.ifBlank { null },
                                )
                            },
                    isLoading = false,
                )
            },
        )
    }

    private fun resolveTitle(
        chatId: String?,
        fallback: String,
    ): String {
        val resolvedChatId = chatId?.trim().orEmpty()
        if (resolvedChatId.isBlank()) return fallback
        return host.currentChats()
            .find { it.chatId == resolvedChatId }
            ?.partnerName
            .orEmpty()
            .ifBlank { fallback }
    }

    private fun overlayFromDto(
        response: VideoCallJoinResponseDto,
        title: String,
        chatId: String?,
    ): GafVideoCallOverlayUi =
        GafVideoCallOverlayUi(
            callId = response.call_id,
            joinUrl = response.join_url.orEmpty(),
            meetBaseUrl = response.meet_base_url.orEmpty(),
            roomName = response.room_name,
            jwt = response.jwt.orEmpty(),
            title = title,
            chatId = chatId,
        )

    private fun joinCallAndShowOverlay(
        callId: String,
        chatId: String?,
        title: String,
    ) {
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { container.chatRepository.joinGafVideoCall(callId) }
            }.onSuccess { join ->
                val resolvedTitle =
                    title.ifBlank {
                        resolveTitle(chatId, host.string(R.string.app_gaf_video_call_default))
                    }
                val joinUrl = join.join_url?.trim().orEmpty()
                if (joinUrl.isBlank()) {
                    Toast.makeText(
                        host.application(),
                        host.string(feature.chat.R.string.chat_video_call_join_failed),
                        Toast.LENGTH_LONG,
                    ).show()
                    return@onSuccess
                }
                applyReduceResult(
                    GafVideoCallStateReducer.reduceApplyJoinOverlay(
                        snapshotState(),
                        GafVideoCallOverlayUi(
                            callId = join.call_id,
                            joinUrl = joinUrl,
                            meetBaseUrl = join.meet_base_url.orEmpty(),
                            roomName = join.room_name,
                            jwt = join.jwt.orEmpty(),
                            title = resolvedTitle,
                            chatId = chatId,
                        ),
                    ),
                )
                host.ensureRealtimeConnected()
            }.onFailure { err ->
                if (err is CancellationException) throw err
                showJoinFailedToast(err)
            }
        }
    }

    private fun startOutgoingJoinPoll(
        callId: String,
        chatId: String?,
        title: String,
    ) {
        cancelOutgoingJoinPoll()
        outgoingJoinPollJob =
            scope.launch {
                while (isActive && _outgoing.value?.callId == callId) {
                    delay(OUTGOING_JOIN_POLL_MS)
                    val joinResult =
                        runCatching {
                            withContext(Dispatchers.IO) {
                                container.chatRepository.joinGafVideoCall(callId)
                            }
                        }
                    joinResult.onSuccess { join ->
                        val joinUrl = join.join_url?.trim().orEmpty()
                        if (joinUrl.isBlank()) return@onSuccess
                        applyReduceResult(
                            GafVideoCallStateReducer.reduceApplyJoinOverlay(
                                snapshotState(),
                                GafVideoCallOverlayUi(
                                    callId = join.call_id,
                                    joinUrl = joinUrl,
                                    meetBaseUrl = join.meet_base_url.orEmpty(),
                                    roomName = join.room_name,
                                    jwt = join.jwt.orEmpty(),
                                    title = title,
                                    chatId = chatId,
                                ),
                            ),
                        )
                        host.ensureRealtimeConnected()
                        return@launch
                    }.onFailure { err ->
                        if (err is CancellationException) return@onFailure
                        if (MobileNetworkFailureSupport.isTransientNetworkFailure(err)) {
                            Log.w(TAG, "[STEP] outgoing_join_poll_network_degrade callId=$callId", err)
                            return@onFailure
                        }
                        MobileTelemetry.reportError(err, "outgoing_join_poll_failed callId=$callId")
                    }
                }
            }
    }

    private fun cancelOutgoingJoinPoll() {
        outgoingJoinPollJob?.cancel()
        outgoingJoinPollJob = null
    }

    private fun showStartFailedToast(err: Throwable) {
        val base = host.string(feature.chat.R.string.chat_video_call_start_failed)
        val detail = err.message ?: err.javaClass.simpleName
        Toast.makeText(host.application(), "$base: $detail", Toast.LENGTH_LONG).show()
    }

    private fun showJoinFailedToast(err: Throwable) {
        val base = host.string(feature.chat.R.string.chat_video_call_join_failed)
        val detail = err.message ?: err.javaClass.simpleName
        Toast.makeText(host.application(), "$base: $detail", Toast.LENGTH_LONG).show()
    }
}
