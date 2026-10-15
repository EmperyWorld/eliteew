/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed SSO callback failures surfaced to the mobile shell (session replace confirm, etc.).
 *
 * Invariants:
 * - Does not carry tokens or authorization codes.
 *
 * Related:
 * - AuthRepository.exchangeAuthorizationCode, MainViewModel
 */
package world.empery.mobile.core.auth

/** SSO callback rejected until the user confirms replacing an active SSO session elsewhere. */
class SsoExchangeConfirmationRequiredException :
    Exception("session_replace_confirmation_required")

/** SSO callback failed with a machine-readable auth reason from the API. */
class SsoExchangeException(
    val reason: String?,
    message: String?,
) : Exception(message)
