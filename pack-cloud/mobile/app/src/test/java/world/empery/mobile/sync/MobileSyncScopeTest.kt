package world.empery.mobile.sync

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileSyncScopeTest {
    @Test
    fun fromWire_mapsKnownScopes() {
        assertEquals(MobileSyncScope.LIGHT, MobileSyncScope.fromWire("light"))
        assertEquals(MobileSyncScope.CHAT, MobileSyncScope.fromWire("chat"))
        assertEquals(MobileSyncScope.ALL, MobileSyncScope.fromWire(null))
    }
}
