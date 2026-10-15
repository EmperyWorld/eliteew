/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for GafVideoCallStateReducer (MA-02.3) — State → Event → State.
 *
 * Related:
 * - GafVideoCallStateReducer.kt, GafVideoCallCoordinator.kt
 */
package feature.chat.videocall

import feature.chat.IncomingCallParticipantUi
import feature.chat.IncomingGafVideoCallUi
import feature.chat.OutgoingGafVideoCallUi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GafVideoCallStateReducerTest {
    private val incomingA =
        IncomingGafVideoCallUi(
            callId = "call-a",
            chatId = "chat-1",
            title = "Alice",
            callerUserId = "u1",
            isGroupCall = false,
            participants =
                listOf(
                    IncomingCallParticipantUi("u1", "Alice", null),
                ),
        )

    private val outgoingA =
        OutgoingGafVideoCallUi(
            callId = "call-a",
            chatId = "chat-1",
            title = "Alice",
        )

    private val overlayA =
        GafVideoCallOverlayUi(
            callId = "call-a",
            joinUrl = "https://meet.example/room",
            meetBaseUrl = "https://meet.example",
            roomName = "room-a",
            jwt = "jwt",
            title = "Alice",
            chatId = "chat-1",
        )

    @Test
    fun idle_plusIncomingReceived_setsIncomingState() {
        val before = GafVideoCallState()
        val after =
            GafVideoCallStateReducer.reduceSetIncoming(
                before,
                incomingA,
                appInForeground = true,
            )
        assertEquals(incomingA, after.state.incoming)
        assertNull(after.state.overlay)
        assertTrue(after.effects.any { it is GafVideoCallEffect.NavigateToChatTab })
    }

    @Test
    fun incomingDuplicate_isSkipped() {
        val before = GafVideoCallState(incoming = incomingA)
        val after =
            GafVideoCallStateReducer.reduceSetIncoming(
                before,
                incomingA,
                appInForeground = true,
            )
        assertTrue(after.skipped)
        assertEquals(before, after.state)
    }

    @Test
    fun incomingAccepted_clearsIncomingAndStopsRingtone() {
        val before = GafVideoCallState(incoming = incomingA)
        val after = GafVideoCallStateReducer.reduceAcceptIncoming(before)
        requireNotNull(after)
        assertNull(after.state.incoming)
        assertTrue(after.effects.any { it is GafVideoCallEffect.StopIncomingRingtone })
        assertTrue(after.effects.any { it == GafVideoCallEffect.PauseMedia })
    }

    @Test
    fun incomingEnded_clearsIncomingAndStopsRingtone() {
        val before = GafVideoCallState(incoming = incomingA)
        val after =
            GafVideoCallStateReducer.reduceRemoteEnded(
                before,
                callId = "call-a",
                missedReason = null,
                status = null,
            )
        assertNull(after.state.incoming)
        assertTrue(after.effects.any { it is GafVideoCallEffect.StopIncomingRingtone })
    }

    @Test
    fun outgoingAcceptedRemote_clearsOutgoingAndCancelsPoll() {
        val before = GafVideoCallState(outgoing = outgoingA)
        val after = GafVideoCallStateReducer.reduceRemoteAccepted(before, "call-a")
        assertNull(after.state.outgoing)
        assertEquals(GafVideoCallEffect.CancelOutgoingJoinPoll, after.effects.single())
    }

    @Test
    fun acceptedWithoutLocalOutgoing_skips() {
        val before = GafVideoCallState()
        val after = GafVideoCallStateReducer.reduceRemoteAccepted(before, "call-a")
        assertTrue(after.skipped)
        assertTrue(after.effects.isEmpty())
    }

    @Test
    fun incomingAcceptedElsewhere_clearsIncomingAndStopsRingtone() {
        val before = GafVideoCallState(incoming = incomingA)
        val after = GafVideoCallStateReducer.reduceRemoteAccepted(before, "call-a")
        assertNull(after.state.incoming)
        assertEquals(
            listOf(GafVideoCallEffect.StopIncomingRingtone("call-a")),
            after.effects,
        )
    }

    @Test
    fun outgoingEndedMissed_showsToastAndClearsOutgoing() {
        val before = GafVideoCallState(outgoing = outgoingA)
        val after =
            GafVideoCallStateReducer.reduceRemoteEnded(
                before,
                callId = "call-a",
                missedReason = "no_answer",
                status = "missed",
            )
        assertNull(after.state.outgoing)
        assertTrue(after.effects.any { it is GafVideoCallEffect.ShowMissedCallToast })
    }

    @Test
    fun activeEnded_clearsOverlayAndFinishesWebView() {
        val before = GafVideoCallState(overlay = overlayA)
        val after = GafVideoCallStateReducer.reduceEndActive(before)
        requireNotNull(after)
        assertNull(after.state.overlay)
        assertTrue(after.effects.any { it is GafVideoCallEffect.FinishMeetWebView })
        assertTrue(after.effects.any { it is GafVideoCallEffect.EndCallOnServer })
    }

    @Test
    fun activeEndedByRemote_clearsOverlay() {
        val before = GafVideoCallState(overlay = overlayA)
        val after =
            GafVideoCallStateReducer.reduceRemoteEnded(
                before,
                callId = "call-a",
                missedReason = null,
                status = "ended",
            )
        assertNull(after.state.overlay)
        assertTrue(after.effects.any { it is GafVideoCallEffect.FinishMeetWebView })
    }

    @Test
    fun clearStaleBeforeNewCall_endsPreviousOverlayWhenDifferentCall() {
        val before = GafVideoCallState(overlay = overlayA)
        val after =
            GafVideoCallStateReducer.reduceClearStaleBeforeNew(
                before,
                keepCallIds = setOf("call-b"),
            )
        assertNull(after.state.overlay)
        assertTrue(after.effects.any { it is GafVideoCallEffect.EndCallOnServer })
    }

    @Test
    fun resetLogout_clearsAllSlices() {
        val after = GafVideoCallStateReducer.reduceLogoutReset()
        assertEquals(GafVideoCallState(), after.state)
        assertTrue(after.effects.any { it is GafVideoCallEffect.CancelOutgoingJoinPoll })
        assertTrue(after.effects.any { it is GafVideoCallEffect.StopIncomingRingtone })
    }
}
