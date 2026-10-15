/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for notification delta merge (unchanged, new, updated, deleted).
 *
 * Invariants:
 * - —
 *
 * Related:
 * - NotificationLogic.kt, NotificationCenterRepository
 */
package feature.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.storage.NotificationEntity

class NotificationDeltaMergeTest {
    private fun row(id: String, title: String = "t", readAt: String? = null) =
        NotificationEntity(id = id, source = "chat", type = "info", title = title, message = "m", createdAt = "2026-06-01T10:00:00Z", readAt = readAt)

    @Test
    fun unchanged_keepsCached() {
        val cached = listOf(row("a"), row("b"))
        val result = mergeNotificationSnapshot(cached, emptyList(), unchanged = true)
        assertEquals(cached, result.items)
        assertTrue(result.addedIds.isEmpty())
        assertTrue(result.updatedIds.isEmpty())
        assertTrue(result.deletedIds.isEmpty())
    }

    @Test
    fun merge_detectsNewUpdatedDeleted() {
        val cached = listOf(row("a", "old"), row("b"), row("c"))
        val incoming = listOf(row("a", "new"), row("d"))
        val result = mergeNotificationSnapshot(cached, incoming, unchanged = false)
        assertEquals(setOf("d"), result.addedIds)
        assertEquals(setOf("a"), result.updatedIds)
        assertEquals(setOf("b", "c"), result.deletedIds)
        assertEquals(listOf("a", "d"), result.items.map { it.id })
    }
}
