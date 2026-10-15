package world.empery.mobile.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileShellTabErrorsTest {
    @Test
    fun resolveFirstShellTabError_returnsFirstNonBlank() {
        assertEquals(
            "feed failed",
            resolveFirstShellTabError(null, "", "feed failed", "chat failed"),
        )
    }

    @Test
    fun resolveFirstShellTabError_returnsNullWhenAllBlank() {
        assertNull(resolveFirstShellTabError(null, "", "  "))
    }

    @Test
    fun resolveFirstShellTabError_prefersEarlierTab() {
        assertEquals(
            "profile",
            resolveFirstShellTabError("profile", "ugs"),
        )
    }
}
