/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for notification deeplink id coercion and list focus resolution.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - NotificationDeepLinkSupport.kt
 */
package feature.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.storage.NotificationEntity

class NotificationDeepLinkTest {
    private fun entity(id: String, source: String = "chat") =
        NotificationEntity(id, source, "info", "Title", "Body", "2026-06-01T10:00:00Z", null)

    @Test
    fun coerceNotificationId_trimsAndRejectsBlank() {
        assertEquals("n-1", coerceNotificationId("  n-1  "))
        assertNull(coerceNotificationId(""))
        assertNull(coerceNotificationId("   "))
        assertNull(coerceNotificationId(null))
    }

    @Test
    fun resolveDeepLink_opensDetailAndScrollIndex() {
        val items = listOf(entity("a", "friends"), entity("b", "chat"), entity("c", "chat"))
        val result = resolveNotificationDeepLinkFocus("b", items)
        assertEquals("b", result.focusedNotificationId)
        assertEquals("b", result.detailItem?.id)
        assertTrue((result.listScrollIndex ?: -1) >= 0)
    }

    @Test
    fun resolveDeepLink_unknownId_keepsFocusWithoutDetail() {
        val items = listOf(entity("a"))
        val result = resolveNotificationDeepLinkFocus("missing", items)
        assertEquals("missing", result.focusedNotificationId)
        assertNull(result.detailItem)
        assertNull(result.listScrollIndex)
    }

    @Test
    fun findScrollIndex_countsGroupHeaders() {
        val groups =
            listOf(
                InboxGroup("chat|INFO", "chat", NotificationSeverity.INFO, listOf(entity("x"), entity("y"))),
                InboxGroup("ugs|WARNING", "ugs", NotificationSeverity.WARNING, listOf(entity("z"))),
            )
        assertEquals(2, findNotificationListScrollIndex(groups, "y"))
        assertEquals(4, findNotificationListScrollIndex(groups, "z"))
        assertNull(findNotificationListScrollIndex(groups, "missing"))
    }
}
