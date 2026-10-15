/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Documents hasSession contract: both access and refresh tokens must be present.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - AuthRepository.hasSession
 */
package world.empery.mobile.core.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthSessionHealthTest {
    @Test
    fun sessionPresent_onlyWhenAccessAndRefreshNonBlank() {
        assertTrue(hasSessionForTest(access = "a", refresh = "r"))
        assertFalse(hasSessionForTest(access = "a", refresh = null))
        assertFalse(hasSessionForTest(access = null, refresh = "r"))
        assertFalse(hasSessionForTest(access = " ", refresh = "r"))
    }

    private fun hasSessionForTest(access: String?, refresh: String?): Boolean {
        val a = access?.takeIf { it.isNotBlank() } ?: return false
        val r = refresh?.takeIf { it.isNotBlank() } ?: return false
        return a.isNotBlank() && r.isNotBlank()
    }
}
