/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fail-closed error when encrypted OAuth token storage cannot be opened or written.
 *
 * Invariants:
 * - Never silently fall back to plaintext or process-only RAM sessions.
 *
 * Related:
 * - SecureTokenStore, AuthRepository
 */
package world.empery.mobile.core.auth

class SecurityStorageException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
