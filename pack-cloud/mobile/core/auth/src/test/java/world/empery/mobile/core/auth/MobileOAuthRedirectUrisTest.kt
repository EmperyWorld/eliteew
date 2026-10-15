/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MobileOAuthRedirectUris canonicalize / Keycloak variant registration.
 *
 * Invariants:
 * - Host-form is the wire form; path-form remains an alias for older APKs.
 *
 * Related:
 * - MobileOAuthRedirectUris.kt, keycloak-harden-empery-realm.sh
 */
package world.empery.mobile.core.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileOAuthRedirectUrisTest {
    @Test
    fun canonicalize_pathForm_toHostForm() {
        assertEquals(
            "world.empery.mobile://oauth2redirect",
            MobileOAuthRedirectUris.canonicalize("world.empery.mobile:/oauth2redirect"),
        )
    }

    @Test
    fun canonicalize_hostForm_idempotent() {
        assertEquals(
            "world.empery.mobile://oauth2redirect",
            MobileOAuthRedirectUris.canonicalize("world.empery.mobile://oauth2redirect"),
        )
    }

    @Test
    fun keycloakRegistrationVariants_includesBothForms() {
        val variants =
            MobileOAuthRedirectUris.keycloakRegistrationVariants(
                "world.empery.mobile:/oauth2redirect",
            )
        assertTrue(variants.contains("world.empery.mobile://oauth2redirect"))
        assertTrue(variants.contains("world.empery.mobile:/oauth2redirect"))
        assertEquals(2, variants.size)
    }
}
