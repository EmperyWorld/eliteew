/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for SecurityStorageException / fail-closed SecureTokenStore contract surface.
 *
 * Related:
 * - SecureTokenStore, AuthRepository
 */
package world.empery.mobile.core.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class SecurityStorageExceptionTest {
    @Test
    fun exceptionCarriesMessageAndCause() {
        val cause = IllegalStateException("keystore")
        val ex = SecurityStorageException("EncryptedSharedPreferences unavailable", cause)
        assertEquals("EncryptedSharedPreferences unavailable", ex.message)
        assertEquals(cause, ex.cause)
    }
}
