package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UgsDeepLinkSupportTest {
    @Test
    fun coerceUgsNestedRoute_chatAlias() {
        assertEquals("ugs/chat", coerceUgsNestedRoute("ai-chat"))
    }

    @Test
    fun coerceUgsNestedRoute_unknownReturnsNullForBlank() {
        assertNull(coerceUgsNestedRoute(""))
    }
}
