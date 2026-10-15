/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure notification inbox logic: filters, source/severity grouping, delta merge, safe payload.
 *
 * Invariants:
 * - No Android Context; unit-testable without Robolectric.
 *
 * Related:
 * - NotificationCenterRepository, NotificationFeature.kt, NotificationDeepLinkSupport.kt
 */
package feature.notifications

import world.empery.mobile.core.storage.NotificationEntity

enum class NotificationFilter {
    ALL,
    UNREAD,
    FRIENDS,
    CHAT,
    SYSTEM,
    UGS,
    DESKTOP,
}

enum class NotificationSeverity {
    ERROR,
    WARNING,
    INFO,
    SUCCESS,
    UNKNOWN,
}

enum class NotificationCategory {
    FRIENDS,
    CHAT,
    SYSTEM,
    UGS,
    DESKTOP,
    OTHER,
}

data class InboxGroup(
    val groupKey: String,
    val sourceKey: String,
    val severity: NotificationSeverity,
    val items: List<NotificationEntity>,
)

data class SafeNotificationPayload(
    val id: String,
    val title: String,
    val message: String,
    val source: String,
    val type: String,
    val createdAtRaw: String?,
    val isUnread: Boolean,
)

sealed interface NotificationCta {
    data object OpenFriends : NotificationCta
    data object OpenChat : NotificationCta
    data object OpenUgs : NotificationCta
    data object OpenDesktop : NotificationCta
    data object MarkRead : NotificationCta
}

data class NotificationMergeResult(
    val items: List<NotificationEntity>,
    val addedIds: Set<String>,
    val updatedIds: Set<String>,
    val deletedIds: Set<String>,
)

private const val MAX_TITLE_LEN = 512
private const val MAX_MESSAGE_LEN = 4_000

fun resolveSeverity(type: String?): NotificationSeverity =
    when (type?.trim()?.lowercase()) {
        "error" -> NotificationSeverity.ERROR
        "warning" -> NotificationSeverity.WARNING
        "info" -> NotificationSeverity.INFO
        "success" -> NotificationSeverity.SUCCESS
        else -> NotificationSeverity.UNKNOWN
    }

fun resolveCategory(source: String?, type: String?): NotificationCategory {
    val blob = "${source.orEmpty()} ${type.orEmpty()}".lowercase()
    return when {
        "friend" in blob || "gaf" in blob && "chat" !in blob -> NotificationCategory.FRIENDS
        "chat" in blob || "message" in blob || "gafchat" in blob -> NotificationCategory.CHAT
        "ugs" in blob || "song" in blob || "image" in blob -> NotificationCategory.UGS
        "desktop" in blob || "ewdesk" in blob || "companion" in blob -> NotificationCategory.DESKTOP
        "system" in blob || "update" in blob || "security" in blob || "perimeter" in blob -> NotificationCategory.SYSTEM
        else -> NotificationCategory.OTHER
    }
}

fun matchesFilter(entity: NotificationEntity, filter: NotificationFilter): Boolean =
    when (filter) {
        NotificationFilter.ALL -> true
        NotificationFilter.UNREAD -> entity.readAt.isNullOrBlank()
        NotificationFilter.FRIENDS -> resolveCategory(entity.source, entity.type) == NotificationCategory.FRIENDS
        NotificationFilter.CHAT -> resolveCategory(entity.source, entity.type) == NotificationCategory.CHAT
        NotificationFilter.SYSTEM ->
            resolveCategory(entity.source, entity.type) == NotificationCategory.SYSTEM ||
                resolveCategory(entity.source, entity.type) == NotificationCategory.OTHER
        NotificationFilter.UGS -> resolveCategory(entity.source, entity.type) == NotificationCategory.UGS
        NotificationFilter.DESKTOP -> resolveCategory(entity.source, entity.type) == NotificationCategory.DESKTOP
    }

fun filterNotifications(
    items: List<NotificationEntity>,
    filter: NotificationFilter,
): List<NotificationEntity> = items.filter { matchesFilter(it, filter) }

fun severityRank(severity: NotificationSeverity): Int =
    when (severity) {
        NotificationSeverity.ERROR -> 0
        NotificationSeverity.WARNING -> 1
        NotificationSeverity.INFO -> 2
        NotificationSeverity.SUCCESS -> 3
        NotificationSeverity.UNKNOWN -> 4
    }

fun groupInboxBySourceAndSeverity(items: List<NotificationEntity>): List<InboxGroup> {
    val filtered = items
    val grouped = linkedMapOf<Pair<String, NotificationSeverity>, MutableList<NotificationEntity>>()
    for (item in filtered) {
        val sourceKey = item.source?.trim()?.takeIf { it.isNotEmpty() } ?: "_unknown"
        val severity = resolveSeverity(item.type)
        grouped.getOrPut(sourceKey to severity) { mutableListOf() }.add(item)
    }
    return grouped.entries
        .map { (key, list) ->
            val sorted = list.sortedByDescending { parseCreatedEpochMillis(it.createdAt) }
            InboxGroup(
                groupKey = "${key.first}|${key.second.name}",
                sourceKey = key.first,
                severity = key.second,
                items = sorted,
            )
        }
        .sortedWith(compareBy({ severityRank(it.severity) }, { it.sourceKey.lowercase() }))
}

fun parseCreatedEpochMillis(createdAt: String?): Long {
    if (createdAt.isNullOrBlank()) return Long.MIN_VALUE
    val normalized = createdAt.trim().replace(' ', 'T')
    return try {
        java.time.Instant.parse(normalized).toEpochMilli()
    } catch (_: Exception) {
        try {
            java.time.Instant.parse("${normalized}Z").toEpochMilli()
        } catch (_: Exception) {
            Long.MIN_VALUE
        }
    }
}

fun mergeNotificationSnapshot(
    cached: List<NotificationEntity>,
    incoming: List<NotificationEntity>,
    unchanged: Boolean,
): NotificationMergeResult {
    if (unchanged) {
        return NotificationMergeResult(cached, emptySet(), emptySet(), emptySet())
    }
    val cachedById = cached.associateBy { it.id }
    val incomingById = incoming.associateBy { it.id }
    val added = incomingById.keys - cachedById.keys
    val deleted = cachedById.keys - incomingById.keys
    val updated =
        incomingById.keys.intersect(cachedById.keys)
            .filter { incomingById.getValue(it) != cachedById.getValue(it) }
            .toSet()
    val merged =
        incoming.sortedByDescending { parseCreatedEpochMillis(it.createdAt) }
    return NotificationMergeResult(merged, added, updated, deleted)
}

private fun sanitizeText(raw: String?, maxLen: Int): String {
    if (raw.isNullOrBlank()) return ""
    val cleaned = buildString(raw.length) {
        for (ch in raw.trim()) {
            if (!ch.isISOControl() || ch == '\n' || ch == '\t') append(ch)
        }
    }
    return if (cleaned.length <= maxLen) cleaned else cleaned.take(maxLen) + "…"
}

fun sanitizeNotificationPayload(entity: NotificationEntity): SafeNotificationPayload {
    val unread = entity.readAt.isNullOrBlank()
    return SafeNotificationPayload(
        id = entity.id,
        title = sanitizeText(entity.title, MAX_TITLE_LEN).ifBlank { entity.id },
        message = sanitizeText(entity.message, MAX_MESSAGE_LEN),
        source = sanitizeText(entity.source, 256).ifBlank { "unknown" },
        type = sanitizeText(entity.type, 64).ifBlank { "info" },
        createdAtRaw = entity.createdAt,
        isUnread = unread,
    )
}

fun resolveNotificationCta(entity: NotificationEntity): NotificationCta? {
    if (entity.readAt.isNullOrBlank()) return NotificationCta.MarkRead
    return when (resolveCategory(entity.source, entity.type)) {
        NotificationCategory.FRIENDS -> NotificationCta.OpenFriends
        NotificationCategory.CHAT -> NotificationCta.OpenChat
        NotificationCategory.UGS -> NotificationCta.OpenUgs
        NotificationCategory.DESKTOP -> NotificationCta.OpenDesktop
        NotificationCategory.SYSTEM, NotificationCategory.OTHER -> null
    }
}
