/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolved runtime URLs for API, SSO facade, and Keycloak OIDC (AppAuth Custom Tabs login).
 *
 * Invariants:
 * - HTTPS required for prod/dev/stage/tg flavors; redirect URI uses flavor custom scheme.
 *
 * Related:
 * - AppContainer, MobileSsoAuthFactory, MainViewModel
 */
package world.empery.mobile

import android.content.Context
import android.util.Log
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore

data class AppRuntimeConfig(
    val baseUrl: String,
    val keycloakRedirectUri: String,
    val ssoLoginUrl: String,
    val keycloakClientId: String,
    val keycloakAuthorizationEndpoint: String,
    val keycloakTokenEndpoint: String,
    val keycloakPublicUrl: String,
    val connectionMode: MobileConnectionMode,
) {
    companion object {
        private const val TAG = "AppRuntimeConfig"

        fun from(context: Context): AppRuntimeConfig {
            val appContext = context.applicationContext
            val rawBase = appContext.getString(R.string.config_base_url).trim()
            val rawRedirect = appContext.getString(R.string.config_keycloak_redirect_uri).trim()
            val rawSso = appContext.getString(R.string.config_sso_login_url).trim()
            val rawClientId = appContext.getString(R.string.config_keycloak_client_id).trim()
            val rawAuthEndpoint = appContext.getString(R.string.config_keycloak_authorization_endpoint).trim()
            val rawTokenEndpoint = appContext.getString(R.string.config_keycloak_token_endpoint).trim()
            val rawKeycloakPublic = appContext.getString(R.string.config_keycloak_public_url).trim()
            val connectionMode = MobileConnectionModeStore.read(appContext)

            val requiresHttps =
                BuildConfig.FLAVOR.equals("prod", ignoreCase = true) ||
                    BuildConfig.FLAVOR.equals("dev", ignoreCase = true) ||
                    BuildConfig.FLAVOR.equals("stage", ignoreCase = true) ||
                    BuildConfig.FLAVOR.equals("tg", ignoreCase = true)

            val baseUrl = rawBase.ifEmpty { BuildConfig.BASE_URL.trim() }
            val keycloakRedirectUri = rawRedirect.ifEmpty { BuildConfig.KEYCLOAK_REDIRECT_URI.trim() }
            val ssoLoginUrl = rawSso.ifEmpty { BuildConfig.SSO_LOGIN_URL.trim() }
            val keycloakClientId = rawClientId.ifEmpty { BuildConfig.KEYCLOAK_CLIENT_ID.trim() }
            val keycloakAuthorizationEndpoint =
                rawAuthEndpoint.ifEmpty { BuildConfig.KEYCLOAK_AUTHORIZATION_ENDPOINT.trim() }
            val keycloakTokenEndpoint =
                rawTokenEndpoint.ifEmpty { BuildConfig.KEYCLOAK_TOKEN_ENDPOINT.trim() }
            val keycloakPublicUrl = rawKeycloakPublic.ifEmpty { BuildConfig.KEYCLOAK_PUBLIC_URL.trim() }

            validate(
                baseUrl = baseUrl,
                keycloakRedirectUri = keycloakRedirectUri,
                ssoLoginUrl = ssoLoginUrl,
                keycloakClientId = keycloakClientId,
                keycloakAuthorizationEndpoint = keycloakAuthorizationEndpoint,
                keycloakTokenEndpoint = keycloakTokenEndpoint,
                keycloakPublicUrl = keycloakPublicUrl,
                requiresHttps = requiresHttps,
                rawBase = rawBase,
                rawRedirect = rawRedirect,
                rawSso = rawSso,
            )

            return AppRuntimeConfig(
                baseUrl = baseUrl,
                keycloakRedirectUri = keycloakRedirectUri,
                ssoLoginUrl = ssoLoginUrl,
                keycloakClientId = keycloakClientId,
                keycloakAuthorizationEndpoint = keycloakAuthorizationEndpoint,
                keycloakTokenEndpoint = keycloakTokenEndpoint,
                keycloakPublicUrl = keycloakPublicUrl,
                connectionMode = connectionMode,
            )
        }

        private fun validate(
            baseUrl: String,
            keycloakRedirectUri: String,
            ssoLoginUrl: String,
            keycloakClientId: String,
            keycloakAuthorizationEndpoint: String,
            keycloakTokenEndpoint: String,
            keycloakPublicUrl: String,
            requiresHttps: Boolean,
            rawBase: String,
            rawRedirect: String,
            rawSso: String,
        ) {
            val issues = mutableListOf<String>()

            if (baseUrl.isEmpty()) {
                issues += "baseUrl is empty (strings + BuildConfig.BASE_URL)"
            } else {
                if (!isHttpOrHttps(baseUrl)) {
                    issues += "baseUrl must start with http:// or https:// (got: ${baseUrl.take(64)})"
                }
                if (requiresHttps && !baseUrl.lowercase().startsWith("https://")) {
                    issues += "baseUrl must use https (flavor=${BuildConfig.FLAVOR})"
                }
            }

            if (ssoLoginUrl.isEmpty()) {
                issues += "ssoLoginUrl is empty (strings + BuildConfig.SSO_LOGIN_URL)"
            } else {
                if (!isHttpOrHttps(ssoLoginUrl)) {
                    issues += "ssoLoginUrl must start with http:// or https:// (got: ${ssoLoginUrl.take(64)})"
                }
                if (requiresHttps && !ssoLoginUrl.lowercase().startsWith("https://")) {
                    issues += "ssoLoginUrl must use https (flavor=${BuildConfig.FLAVOR})"
                }
            }

            if (keycloakRedirectUri.isEmpty()) {
                issues += "keycloakRedirectUri is empty (strings + BuildConfig.KEYCLOAK_REDIRECT_URI)"
            } else if (!keycloakRedirectUri.contains(":")) {
                issues +=
                    "keycloakRedirectUri must be a custom scheme URI (e.g. app:/path), got: ${keycloakRedirectUri.take(64)}"
            }

            if (keycloakClientId.isEmpty()) {
                issues += "keycloakClientId is empty"
            }

            for ((label, value) in listOf(
                "keycloakAuthorizationEndpoint" to keycloakAuthorizationEndpoint,
                "keycloakTokenEndpoint" to keycloakTokenEndpoint,
                "keycloakPublicUrl" to keycloakPublicUrl,
            )) {
                if (value.isEmpty()) {
                    issues += "$label is empty"
                } else if (!isHttpOrHttps(value)) {
                    issues += "$label must start with http:// or https:// (got: ${value.take(64)})"
                } else if (requiresHttps && !value.lowercase().startsWith("https://")) {
                    issues += "$label must use https (flavor=${BuildConfig.FLAVOR})"
                }
            }

            if (issues.isEmpty()) return

            val detail = issues.joinToString("; ")
            val devHint =
                if (BuildConfig.DEBUG) {
                    " flavor=${BuildConfig.FLAVOR} buildType=${BuildConfig.BUILD_TYPE}" +
                        " raw=[base=${rawBase.isEmpty()}/${rawBase.length}ch redirect=${rawRedirect.isEmpty()}/${rawRedirect.length}ch sso=${rawSso.isEmpty()}/${rawSso.length}ch]" +
                        " — check app build.gradle.kts resValue / buildConfigField for this flavor"
                } else {
                    ""
                }
            val message = "Invalid app runtime config: $detail$devHint"

            if (BuildConfig.DEBUG) {
                Log.e(TAG, message)
            }

            throw IllegalStateException(message)
        }

        private fun isHttpOrHttps(value: String): Boolean {
            val v = value.lowercase()
            return v.startsWith("https://") || v.startsWith("http://")
        }
    }
}
