/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JVM tests for app-layer merge of NotificationDeepLinkSupport into tab UI state.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - NotificationsTabViewModel.kt, NotificationDeepLinkSupport.kt
 */
package world.empery.mobile.tabs

import feature.notifications.NotificationCenterUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.core.storage.NotificationEntity

class NotificationsTabDeepLinkWiringTest {
    private fun entity(id: String) =
        NotificationEntity(id, "chat", "info", "Title", "Body", "2026-06-01T10:00:00Z", null)

    @Test
    fun mergeDeepLink_opensDetailAndSetsFocus() {
        val items = listOf(entity("a"), entity("b"))
        val merged = mergeNotificationDeepLinkFocus(NotificationCenterUiState(), items, "b")
        assertEquals(items, merged.items)
        assertEquals("b", merged.focusedNotificationId)
        assertEquals("b", merged.detailItem?.id)
    }

    @Test
    fun mergeDeepLink_unknownId_keepsFocusWithoutDetail() {
        val items = listOf(entity("a"))
        val merged = mergeNotificationDeepLinkFocus(NotificationCenterUiState(), items, "missing")
        assertEquals("missing", merged.focusedNotificationId)
        assertNull(merged.detailItem)
    }

    @Test
    fun mergeDeepLink_blankId_clearsFocus() {
        val prior = NotificationCenterUiState(focusedNotificationId = "old", detailItem = entity("old"))
        val merged = mergeNotificationDeepLinkFocus(prior, emptyList(), "   ")
        assertNull(merged.focusedNotificationId)
        assertEquals("old", merged.detailItem?.id)
    }
}
