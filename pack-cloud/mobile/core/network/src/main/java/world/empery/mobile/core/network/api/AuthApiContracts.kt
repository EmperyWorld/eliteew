/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for mobile auth endpoints (SSO callback, refresh, logout).
 *
 * Invariants:
 * - Gson SerializedName on all JSON fields for R8 release builds.
 *
 * Related:
 * - AuthRepository, NetworkFactory
 */
package world.empery.mobile.core.network.api

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.POST

/** Gson: explicit names so R8 release builds do not emit `a`/`b`/… for JSON keys. */
data class TokenRefreshRequest(
    @SerializedName("refresh_token")
    val refresh_token: String,
)

data class SsoLogoutRequest(
    @SerializedName("refresh_token")
    val refresh_token: String,
)

data class TokenRefreshResponse(
    @SerializedName("access_token")
    val access_token: String,
    @SerializedName("refresh_token")
    val refresh_token: String,
    @SerializedName("expires_in")
    val expires_in: Int,
    @SerializedName("token_type")
    val token_type: String,
)

data class SsoCallbackRequest(
    @SerializedName("code")
    val code: String,
    @SerializedName("state")
    val state: String? = null,
    @SerializedName("redirect_uri")
    val redirect_uri: String,
    @SerializedName("code_verifier")
    val code_verifier: String? = null,
)

data class SsoCallbackTokens(
    @SerializedName("access_token")
    val access_token: String,
    @SerializedName("refresh_token")
    val refresh_token: String,
    @SerializedName("expires_in")
    val expires_in: Int,
    @SerializedName("token_type")
    val token_type: String,
)

data class SsoCallbackResponse(
    @SerializedName("tokens")
    val tokens: SsoCallbackTokens,
)

data class SsoLogoutResponse(
    @SerializedName("message")
    val message: String? = null,
    @SerializedName("logout_url")
    val logout_url: String? = null,
)

interface AuthApi {
    /** JSON refresh lives under `/api/auth/refresh` (not under `/api/v1/`). Path is absolute from host. */
    @POST("/api/auth/refresh")
    suspend fun refresh(@Body body: TokenRefreshRequest): TokenRefreshResponse

    @POST("/api/v1/auth/sso/callback")
    suspend fun ssoCallback(
        @Body body: SsoCallbackRequest,
        @retrofit2.http.Header("X-SSO-Replace-Confirm") replaceConfirm: String? = null,
    ): SsoCallbackResponse

    @POST("/api/v1/auth/sso/logout")
    suspend fun ssoLogout(
        @Body body: SsoLogoutRequest,
    ): SsoLogoutResponse
}
