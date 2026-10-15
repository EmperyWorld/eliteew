/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for NetworkLinkSnapshot equality used by soft socket handover.
 */
package world.empery.mobile.connectivity

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class NetworkLinkSnapshotTest {
    @Test
    fun differentTransportsAreDistinctIdentities() {
        val wifi = NetworkLinkSnapshot(validatedOnline = true, linkIdentity = "net1_wifi")
        val cell = NetworkLinkSnapshot(validatedOnline = true, linkIdentity = "net2_cell")
        assertNotEquals(wifi.linkIdentity, cell.linkIdentity)
        assertEquals(true, wifi.validatedOnline)
    }
}
