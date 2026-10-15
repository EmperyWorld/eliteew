package world.empery.mobile.push

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingCallAlertSupportTest {
    @Test
    fun suppressesKnownVideoCallSystemBodyFromFcm() {
        assertTrue(
            IncomingCallAlertSupport.shouldSuppressChatNotificationData(
                mapOf("body" to "Видеозвонок начат", "type" to "gaf_chat_message"),
            ),
        )
    }

    @Test
    fun suppressesMetadataKindFromFcm() {
        assertTrue(
            IncomingCallAlertSupport.shouldSuppressChatNotificationData(
                mapOf("metadata_kind" to "video_call_event", "body" to "Видеозвонок начат"),
            ),
        )
    }

    @Test
    fun allowsRegularChatMessageFromFcm() {
        assertFalse(
            IncomingCallAlertSupport.shouldSuppressChatNotificationData(
                mapOf("body" to "Привет", "type" to "gaf_chat_message"),
            ),
        )
    }
}
