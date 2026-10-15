/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock: SecureTokenStore persist failure forces AuthRepository session termination.
 *
 * Related:
 * - SecureTokenStore, AuthRepository, SecurityStorageException
 */
package world.empery.mobile.core.auth

import android.content.SharedPreferences
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.core.network.AccessTokenRefreshResult
import world.empery.mobile.core.network.api.AuthApi
import world.empery.mobile.core.network.api.SsoCallbackRequest
import world.empery.mobile.core.network.api.SsoCallbackResponse
import world.empery.mobile.core.network.api.SsoLogoutRequest
import world.empery.mobile.core.network.api.SsoLogoutResponse
import world.empery.mobile.core.network.api.TokenRefreshRequest
import world.empery.mobile.core.network.api.TokenRefreshResponse

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AuthRepositorySecureStorageFailClosedTest {

    @Test
    fun persistFailureDuringRefreshForcesLogout() = runBlocking {
        val hybrid =
            object : SharedPreferences {
                override fun getAll(): MutableMap<String, *> = mutableMapOf<String, Any>()
                override fun getString(key: String?, defValue: String?): String? =
                    when (key) {
                        "access_token" -> "access-old"
                        "refresh_token" -> "refresh-ok"
                        else -> defValue
                    }
                override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = defValues
                override fun getInt(key: String?, defValue: Int): Int = defValue
                override fun getLong(key: String?, defValue: Long): Long =
                    if (key == "expires_at") 1L else defValue
                override fun getFloat(key: String?, defValue: Float): Float = defValue
                override fun getBoolean(key: String?, defValue: Boolean): Boolean = defValue
                override fun contains(key: String?): Boolean = key == "access_token" || key == "refresh_token"
                override fun edit(): SharedPreferences.Editor =
                    object : SharedPreferences.Editor {
                        override fun putString(key: String?, value: String?): SharedPreferences.Editor = this
                        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
                        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = this
                        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = this
                        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = this
                        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = this
                        override fun remove(key: String?): SharedPreferences.Editor = this
                        override fun clear(): SharedPreferences.Editor = this
                        override fun commit(): Boolean = false
                        override fun apply() = Unit
                    }
                override fun registerOnSharedPreferenceChangeListener(
                    listener: SharedPreferences.OnSharedPreferenceChangeListener?,
                ) = Unit
                override fun unregisterOnSharedPreferenceChangeListener(
                    listener: SharedPreferences.OnSharedPreferenceChangeListener?,
                ) = Unit
            }

        val store = SecureTokenStore(hybrid)
        val api =
            object : AuthApi {
                override suspend fun refresh(body: TokenRefreshRequest): TokenRefreshResponse =
                    TokenRefreshResponse(
                        access_token = "access-new",
                        refresh_token = "refresh-new",
                        expires_in = 3600,
                        token_type = "Bearer",
                    )

                override suspend fun ssoCallback(
                    body: SsoCallbackRequest,
                    replaceConfirm: String?,
                ): SsoCallbackResponse = error("unused")

                override suspend fun ssoLogout(body: SsoLogoutRequest): SsoLogoutResponse = error("unused")
            }

        val repo = AuthRepository(authApi = api, tokenStore = store)
        var terminated: AuthTerminationReason? = null
        repo.onSessionTerminated = { terminated = it }

        val result = repo.refreshAccessTokenDetailed()
        assertEquals(AccessTokenRefreshResult.FailedAuth, result)
        assertEquals(AuthTerminationReason.RefreshRejected, terminated)
        // hasSession still true if clear() also commits false — forceLogout catches clear failures.
        // Terminal flag is the observable contract for UI logout.
        assertFalse(terminated == null)
    }
}
