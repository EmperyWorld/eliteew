/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for GAF system message metadata parsing and duration formatting.
 *
 * Invariants:
 * - video_call_event kinds mirror desktop GAFChatMessageBubble contract.
 *
 * Related:
 * - GafChatSystemMessageSupport.kt
 */
package feature.chat

import com.google.gson.JsonParser
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GafChatSystemMessageSupportTest {
    @Test
    fun parseVideoCallAcceptedMetadata() {
        val json =
            """
            {"kind":"video_call_event","event":"accepted"}
            """.trimIndent()
        val parsed = parseGafMessageMetadataFromJsonString(json)
        assertNotNull(parsed)
        val event = parsed as GafMessageSystemPresentation.VideoCallEvent
        assertEquals("accepted", event.event)
        assertNull(event.durationSeconds)
    }

    @Test
    fun parseVideoCallEndedWithDuration() {
        val json =
            """
            {"kind":"video_call_event","event":"ended","duration_seconds":125}
            """.trimIndent()
        val parsed = parseGafMessageMetadataFromJsonString(json)
        val event = parsed as GafMessageSystemPresentation.VideoCallEvent
        assertEquals("ended", event.event)
        assertEquals(125, event.durationSeconds)
        assertEquals("2:05", formatGafVideoCallDuration(125))
    }

    @Test
    fun parseVideoCallMissedWithReason() {
        val obj = JSONObject("""{"kind":"video_call_event","event":"missed","missed_reason":"no_answer"}""")
        val parsed = parseGafMessageMetadataFromJSONObject(obj)
        val event = parsed as GafMessageSystemPresentation.VideoCallEvent
        assertEquals("missed", event.event)
        assertEquals("no_answer", event.missedReason)
    }

    @Test
    fun parseOnboardingInstructionMetadata() {
        val parsed =
            parseGafMessageMetadataFromJsonElement(
                JsonParser.parseString("""{"kind":"onboarding_instruction","welcome_text":"Hi"}"""),
            )
        assertTrue(parsed is GafMessageSystemPresentation.OnboardingInstruction)
    }

    @Test
    fun parseSocketPayloadWithMetadataOnly() {
        val payload =
            JSONObject(
                """
                {
                  "chat_id": "c1",
                  "message_id": "m-video",
                  "body": "Видеозвонок принят",
                  "metadata": {
                    "kind": "video_call_event",
                    "event": "accepted"
                  }
                }
                """.trimIndent(),
            )
        val parsed = parseGafChatMessageNewPayload(payload)
        assertNotNull(parsed)
        assertEquals("m-video", parsed!!.messageId)
        val ui = gafChatMessageNewPayloadToUi(parsed)
        assertTrue(ui.systemPresentation is GafMessageSystemPresentation.VideoCallEvent)
        assertTrue(isGafSystemCenteredMessage(ui.systemPresentation))
    }

    @Test
    fun unknownMetadataKindFallsBackToGeneric() {
        val parsed =
            parseGafMessageMetadataFromJsonString("""{"kind":"future_kind","foo":"bar"}""")
        assertTrue(parsed is GafMessageSystemPresentation.Generic)
        assertEquals("future_kind", (parsed as GafMessageSystemPresentation.Generic).kind)
    }

    @Test
    fun invalidVideoCallEventReturnsNull() {
        assertNull(parseGafMessageMetadataFromJsonString("""{"kind":"video_call_event","event":"bogus"}"""))
    }

    @Test
    fun legacyPostCallSummaryBody_resolvesAsSystemEndedEvent() {
        val body = "📞 Видеозвонок с πo&T завершён · ~1 мин"
        assertTrue(isLegacyPostCallSummaryBody(body))
        val presentation = resolveGafMessageSystemPresentation(metadataJson = null, body = body)
        assertTrue(presentation is GafMessageSystemPresentation.VideoCallEvent)
        assertEquals("ended", (presentation as GafMessageSystemPresentation.VideoCallEvent).event)
        assertEquals(60, presentation.durationSeconds)
    }
}
