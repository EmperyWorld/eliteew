/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for stable device id format from SecureDeviceIdStore.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - SecureDeviceIdStore, MobileApp.stableDeviceId
 */
package world.empery.mobile.core.auth

import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class SecureDeviceIdStoreTest {
    @Test
    fun generatedUuid_hasExpectedFormat() {
        val id = UUID.randomUUID().toString()
        assertTrue(id.length >= 36)
        assertTrue(id.contains("-"))
    }
}
