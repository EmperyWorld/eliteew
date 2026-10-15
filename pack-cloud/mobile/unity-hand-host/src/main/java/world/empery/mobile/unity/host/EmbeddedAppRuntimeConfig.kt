package world.empery.mobile.unity.host

import world.empery.mobile.unity.host.BuildConfig

data class EmbeddedAppRuntimeConfig(
    val baseUrl: String,
    val keycloakRedirectUri: String,
    val ssoLoginUrl: String,
    val keycloakClientId: String,
    val keycloakAuthorizationEndpoint: String,
    val keycloakTokenEndpoint: String,
    val keycloakPublicUrl: String,
) {
    companion object {
        fun fromBuildConfig(): EmbeddedAppRuntimeConfig =
            EmbeddedAppRuntimeConfig(
                baseUrl = BuildConfig.BASE_URL,
                keycloakRedirectUri = BuildConfig.KEYCLOAK_REDIRECT_URI,
                ssoLoginUrl = BuildConfig.SSO_LOGIN_URL,
                keycloakClientId = BuildConfig.KEYCLOAK_CLIENT_ID,
                keycloakAuthorizationEndpoint = BuildConfig.KEYCLOAK_AUTHORIZATION_ENDPOINT,
                keycloakTokenEndpoint = BuildConfig.KEYCLOAK_TOKEN_ENDPOINT,
                keycloakPublicUrl = BuildConfig.KEYCLOAK_PUBLIC_URL,
            )
    }
}
