/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notification center repository: cache, delta refresh with merge, mark-read sync.
 *
 * Invariants:
 * - Delta `unchanged=true` keeps local cache; full snapshot replaces rows via merge helper.
 *
 * Related:
 * - NotificationLogic.kt, ProfileApi, NotificationDao
 */
package feature.notifications

import world.empery.mobile.core.network.api.NotificationCenterItemDto
import world.empery.mobile.core.network.api.NotificationCenterPutBody
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.NotificationEntity
import java.time.Instant

class NotificationCenterRepository(
    private val api: ProfileApi,
    private val db: MobileDatabase,
) {
    private var lastUpdatedAt: String? = null

    suspend fun loadFromCache(): List<NotificationEntity> = db.notificationDao().getAll()

    suspend fun refresh(): List<NotificationEntity> {
        val since = lastUpdatedAt?.trim()?.takeIf { it.isNotEmpty() }
        if (since != null) {
            val delta = api.getNotificationCenterDelta(since)
            delta.updated_at?.let { lastUpdatedAt = it }
            if (delta.unchanged) {
                return loadFromCache()
            }
            val mapped = mapNotificationItems(delta.items)
            val cached = loadFromCache()
            val merged = mergeNotificationSnapshot(cached, mapped, unchanged = false)
            persistAll(merged.items)
            return merged.items
        }
        val response = api.getNotificationCenter()
        response.updated_at?.let { lastUpdatedAt = it }
        val mapped = mapNotificationItems(response.items)
        val cached = loadFromCache()
        val merged = mergeNotificationSnapshot(cached, mapped, unchanged = false)
        persistAll(merged.items)
        return merged.items
    }

    suspend fun markRead(ids: Collection<String>): List<NotificationEntity> {
        if (ids.isEmpty()) return loadFromCache()
        val stamp = Instant.now().toString()
        val all = loadFromCache()
        val target = ids.toSet()
        val updated =
            all.map { row ->
                if (row.id in target && row.readAt.isNullOrBlank()) row.copy(readAt = stamp) else row
            }
        persistAll(updated)
        saveSnapshot(updated)
        return updated
    }

    suspend fun markAllRead(): Pair<List<NotificationEntity>, Map<String, String?>> {
        val all = loadFromCache()
        val stamp = Instant.now().toString()
        val undo = linkedMapOf<String, String?>()
        val updated =
            all.map { row ->
                if (row.readAt.isNullOrBlank()) {
                    undo[row.id] = row.readAt
                    row.copy(readAt = stamp)
                } else {
                    row
                }
            }
        if (undo.isNotEmpty()) {
            persistAll(updated)
            saveSnapshot(updated)
        }
        return updated to undo
    }

    suspend fun undoMarkAllRead(undoMap: Map<String, String?>): List<NotificationEntity> {
        if (undoMap.isEmpty()) return loadFromCache()
        val all = loadFromCache()
        val updated =
            all.map { row ->
                if (row.id in undoMap) row.copy(readAt = undoMap[row.id]) else row
            }
        persistAll(updated)
        saveSnapshot(updated)
        return updated
    }

    private suspend fun persistAll(items: List<NotificationEntity>) {
        db.notificationDao().deleteAll()
        if (items.isNotEmpty()) {
            db.notificationDao().upsertAll(items)
        }
    }

    private fun mapNotificationItems(
        items: List<NotificationCenterItemDto>,
    ): List<NotificationEntity> =
        items.map {
            val readAt =
                when {
                    it.read == true -> it.read_at ?: it.created_at ?: Instant.now().toString()
                    !it.read_at.isNullOrBlank() -> it.read_at
                    else -> null
                }
            NotificationEntity(
                id = it.id ?: "${it.source}-${it.created_at}",
                source = it.source,
                type = it.type,
                title = it.title,
                message = it.message,
                createdAt = it.created_at,
                readAt = readAt,
            )
        }

    suspend fun saveSnapshot(items: List<NotificationEntity>) {
        val body = NotificationCenterPutBody(
            items = items.map {
                NotificationCenterItemDto(
                    id = it.id,
                    source = it.source,
                    type = it.type,
                    title = it.title,
                    message = it.message,
                    created_at = it.createdAt,
                    read = !it.readAt.isNullOrBlank(),
                    read_at = it.readAt,
                )
            },
        )
        api.putNotificationCenter(body)
    }
}
