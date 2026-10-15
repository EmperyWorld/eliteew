package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.AuthApi

class AuthApiContractsTest {
    @Test
    fun authRoutesMatchBackendContract() {
        assertEquals("/api/auth/refresh", ApiContractPathAssertions.postPath(AuthApi::class, "refresh"))
        ApiContractPathAssertions.assertPost(AuthApi::class, "ssoCallback", "/api/v1/auth/sso/callback")
        ApiContractPathAssertions.assertPost(AuthApi::class, "ssoLogout", "/api/v1/auth/sso/logout")
    }
}
