package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import world.empery.mobile.core.network.api.FriendsApi

class FriendsApiContractsTest {
    @Test
    fun requestActionsUseBackendPluralRequestsRoutes() {
        assertEquals(
            "friends/users/search",
            getPath("searchUsers"),
        )
        assertEquals(
            "friends/request/by-user/{userId}",
            postPath("sendRequestToUser"),
        )
        assertEquals(
            "friends/{userId}/profile",
            getPath("getFriendProfile"),
        )
        assertEquals(
            "friends/{userId}/relationship",
            patchPath("updateRelationship"),
        )
        assertEquals(
            "friends/{userId}/report",
            postPath("reportUser"),
        )
        assertEquals(
            "friends/circles",
            postPath("createCircle"),
        )
        assertEquals(
            "friends/circles/{circleId}",
            patchPath("updateCircle"),
        )
        assertEquals(
            "friends/circles/{circleId}",
            deletePath("deleteCircle"),
        )
        assertEquals(
            "friends/{userId}",
            deletePath("removeFriend"),
        )
        assertEquals(
            "social-hub/inbox",
            getPath("getSocialHubActionInbox"),
        )
        assertEquals(
            "social-hub/profile/privacy-preview",
            getPath("getSocialHubPrivacyPreview"),
        )
        assertEquals(
            "friends/requests/{requestId}/accept",
            postPath("acceptRequest"),
        )
        assertEquals(
            "friends/requests/{requestId}/reject",
            postPath("rejectRequest"),
        )
        assertEquals(
            "friends/requests/{requestId}/cancel",
            postPath("cancelRequest"),
        )
    }

    @Test
    fun socialHubTimelineRoutesUseBackendPaths() {
        assertEquals("social-hub/feed", getPath("getSocialHubFeed"))
        assertEquals(
            "social-hub/friends/{friendUserId}/shared-content",
            getPath("getSocialHubSharedContent"),
        )
        assertEquals("friends/referral", getPath("getFriendReferralInvite"))
        assertEquals("friends/referral/preview", getPath("previewFriendReferralCode"))
    }

    private fun postPath(methodName: String): String {
        val method = FriendsApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(POST::class.java)).value
    }

    private fun getPath(methodName: String): String {
        val method = FriendsApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(GET::class.java)).value
    }

    private fun patchPath(methodName: String): String {
        val method = FriendsApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(PATCH::class.java)).value
    }

    private fun deletePath(methodName: String): String {
        val method = FriendsApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(DELETE::class.java)).value
    }
}
