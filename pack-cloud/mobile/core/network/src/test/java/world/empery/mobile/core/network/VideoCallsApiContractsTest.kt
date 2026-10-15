package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.VideoCallJoinResponseDto
import world.empery.mobile.core.network.api.VideoCallsApi

class VideoCallsApiContractsTest {
    private val gson = Gson()

    @Test
    fun videoCallRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(
            VideoCallsApi::class,
            "createGafVideoCall",
            "video-calls/gaf-chats/{chatId}",
        )
        ApiContractPathAssertions.assertPost(
            VideoCallsApi::class,
            "createGafGroupVideoCall",
            "video-calls/gaf-chats/{chatId}/group",
        )
        ApiContractPathAssertions.assertPost(
            VideoCallsApi::class,
            "joinVideoCall",
            "video-calls/{callId}/join",
        )
        ApiContractPathAssertions.assertPost(
            VideoCallsApi::class,
            "endVideoCall",
            "video-calls/{callId}/end",
        )
    }

    @Test
    fun parsesJoinResponseWithMeetUrl() {
        val json = """
            {
              "call_id": "call-1",
              "room_name": "gaf-room",
              "status": "active",
              "meet_base_url": "https://meet.eliteew.ru",
              "jwt": "eyJ.test",
              "join_url": "https://meet.eliteew.ru/gaf-room?jwt=eyJ.test"
            }
        """.trimIndent()
        val dto = gson.fromJson(json, VideoCallJoinResponseDto::class.java)
        assertEquals("call-1", dto.call_id)
    }

    @Test
    fun parsesRingingCreateResponseWithoutJoinUrl() {
        val json = """
            {
              "call_id": "call-1",
              "chat_id": "chat-1",
              "room_name": "ew-gaf-room",
              "status": "ringing",
              "call_kind": "direct",
              "callee_user_id": "user-2",
              "awaiting_accept": true,
              "join_url": null,
              "jwt": null
            }
        """.trimIndent()
        val dto = gson.fromJson(json, VideoCallJoinResponseDto::class.java)
        assertEquals("call-1", dto.call_id)
        assertEquals(true, dto.awaiting_accept)
        assertEquals(null, dto.join_url)
    }
}
