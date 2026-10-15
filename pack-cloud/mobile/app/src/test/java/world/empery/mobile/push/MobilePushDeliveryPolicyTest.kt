package world.empery.mobile.push

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobilePushDeliveryPolicyTest {
    @Test
    fun signedOutAllowsIncomingVideoCallOnly() {
        assertTrue(
            MobilePushDeliveryPolicy.allowWhenSignedOut(
                mapOf("type" to "video_call_incoming", "call_id" to "c1"),
            ),
        )
        assertTrue(
            MobilePushDeliveryPolicy.allowWhenSignedOut(
                mapOf("event" to "video_call.incoming", "call_id" to "c2"),
            ),
        )
        assertFalse(
            MobilePushDeliveryPolicy.allowWhenSignedOut(
                mapOf("type" to "gaf_chat_message", "chat_id" to "x", "title" to "hi"),
            ),
        )
        assertFalse(MobilePushDeliveryPolicy.allowWhenSignedOut(emptyMap()))
    }
}
