/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derive Keycloak OIDC endpoint URLs for the native mobile client (realm empery).
 *
 * Invariants:
 * - Public HTTPS base only; client id stays empery-mobile for all app flavors.
 *
 * Related:
 * - AppRuntimeConfig, MobileSsoAuthFactory, OidcAuthManager
 */
package world.empery.mobile.core.auth

object MobileKeycloakOidcEndpoints {
    const val DEFAULT_REALM = "empery"
    const val MOBILE_CLIENT_ID = "empery-mobile"

    fun authorizationEndpoint(publicBaseUrl: String, realm: String = DEFAULT_REALM): String {
        val base = publicBaseUrl.trim().trimEnd('/')
        require(base.isNotEmpty()) { "Keycloak public base URL must not be blank" }
        return "$base/realms/$realm/protocol/openid-connect/auth"
    }

    fun tokenEndpoint(publicBaseUrl: String, realm: String = DEFAULT_REALM): String {
        val base = publicBaseUrl.trim().trimEnd('/')
        require(base.isNotEmpty()) { "Keycloak public base URL must not be blank" }
        return "$base/realms/$realm/protocol/openid-connect/token"
    }

    fun discoveryUrl(publicBaseUrl: String, realm: String = DEFAULT_REALM): String {
        val base = publicBaseUrl.trim().trimEnd('/')
        require(base.isNotEmpty()) { "Keycloak public base URL must not be blank" }
        return "$base/realms/$realm/.well-known/openid-configuration"
    }
}
