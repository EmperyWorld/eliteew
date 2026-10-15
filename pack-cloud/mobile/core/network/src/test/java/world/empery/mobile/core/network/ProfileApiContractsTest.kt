package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.http.GET
import retrofit2.http.PATCH
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.network.ApiContractPathAssertions

class ProfileApiContractsTest {
    @Test
    fun notificationCenterDeltaUsesSinceQueryRoute() {
        assertEquals(
            "profile/notification-center/delta",
            ApiContractPathAssertions.getPath(ProfileApi::class, "getNotificationCenterDelta"),
        )
    }

    @Test
    fun privacyUsesProfileMePrivacyRoutes() {
        assertEquals(
            "profile/me/privacy",
            getPath("getPrivacy"),
        )
        assertEquals(
            "profile/me/privacy",
            patchPath("updatePrivacy"),
        )
    }

    @Test
    fun preferencesUsesProfilePreferencesRoutes() {
        assertEquals(
            "profile/preferences",
            getPath("getPreferences"),
        )
        assertEquals(
            "profile/preferences",
            patchPath("updatePreferences"),
        )
    }

    private fun getPath(methodName: String): String {
        val method = ProfileApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(GET::class.java)).value
    }

    private fun patchPath(methodName: String): String {
        val method = ProfileApi::class.java.declaredMethods.single { it.name == methodName }
        return requireNotNull(method.getAnnotation(PATCH::class.java)).value
    }
}
