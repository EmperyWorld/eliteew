/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC parameters for AppAuth login (endpoints, client id, redirect) decoupled from the app module.
 *
 * Invariants:
 * - redirectUri must match Keycloak empery-mobile Valid redirect URIs for the active flavor.
 *
 * Related:
 * - MobileSsoAuthFactory, OidcAuthManager, AuthRepository
 */
package world.empery.mobile.core.auth

data class MobileOidcRuntimeConfig(
    val authorizationEndpoint: String,
    val tokenEndpoint: String,
    val clientId: String,
    val redirectUri: String,
)
