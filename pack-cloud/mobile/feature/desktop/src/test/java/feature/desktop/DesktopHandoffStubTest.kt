package feature.desktop

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DesktopHandoffStubTest {
    @Test
    fun handoffRecoveredWhenExpired() {
        val draft = resolveDesktopHandoffDraft("hello desktop", expiresEpochMs = 1000L, nowEpochMs = 2000L)
        requireNotNull(draft)
        assertTrue(draft.recovered)
    }

    @Test
    fun emptyDraftReturnsNull() {
        assertNull(resolveDesktopHandoffDraft("  ", expiresEpochMs = 0L))
    }
}
