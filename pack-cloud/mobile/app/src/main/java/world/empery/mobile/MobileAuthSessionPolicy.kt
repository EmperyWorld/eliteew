/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small auth-session policies shared by the mobile shell and JVM contract tests.
 *
 * Invariants:
 * - A successful SSO callback is accepted only after tokens are persisted locally.
 *
 * Related:
 * - MainViewModel, AuthRepository
 */
package world.empery.mobile

internal fun shouldAcceptSsoExchange(exchangeSucceeded: Boolean, hasSession: Boolean): Boolean =
    exchangeSucceeded && hasSession
