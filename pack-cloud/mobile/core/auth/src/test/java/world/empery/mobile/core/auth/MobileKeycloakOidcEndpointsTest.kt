package world.empery.mobile.core.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileKeycloakOidcEndpointsTest {
    @Test
    fun authorizationEndpoint_usesRealmPath() {
        val endpoint =
            MobileKeycloakOidcEndpoints.authorizationEndpoint("https://auth.eliteew.ru")
        assertEquals(
            "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth",
            endpoint,
        )
    }

    @Test
    fun tokenEndpoint_usesRealmPath() {
        val endpoint = MobileKeycloakOidcEndpoints.tokenEndpoint("https://auth.eliteew.ru/")
        assertEquals(
            "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token",
            endpoint,
        )
    }

    @Test
    fun discoveryUrl_usesWellKnownPath() {
        val url = MobileKeycloakOidcEndpoints.discoveryUrl("https://auth.eliteew.ru")
        assertTrue(url.endsWith("/realms/empery/.well-known/openid-configuration"))
    }
}
