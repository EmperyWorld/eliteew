/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friend detail timeline and shared-context row builders (desktop FriendPersonCard parity).
 *
 * Invariants:
 * - Timeline uses profile timestamps only; shared files come from Social Hub shared-content API.
 *
 * Related:
 * - FriendDetailScreen.kt, FriendDetailSharedSections.kt
 */
package feature.friends

import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import java.time.Duration
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

internal data class FriendTimelineEntry(
    val id: String,
    val labelRes: Int,
    val value: String,
)

internal data class FriendSharedContextRow(
    val id: String,
    val labelRes: Int,
    val value: String,
)

/**
 * Honest shared-content presentation phases for friend detail.
 * Loading must not pretend counts are zero; empty is an explicit state, not a blank scaffold.
 */
internal sealed class FriendSharedContentPhase {
    data object Loading : FriendSharedContentPhase()

    data class Error(
        val message: String,
    ) : FriendSharedContentPhase()

    data object Empty : FriendSharedContentPhase()

    data class Ready(
        val items: List<SocialHubSharedContentItemDto>,
        val fromFriendCount: Int,
        val toFriendCount: Int,
    ) : FriendSharedContentPhase()
}

internal fun resolveFriendSharedContentPhase(
    items: List<SocialHubSharedContentItemDto>,
    isLoading: Boolean,
    errorMessage: String?,
): FriendSharedContentPhase {
    if (isLoading) return FriendSharedContentPhase.Loading
    if (errorMessage != null) return FriendSharedContentPhase.Error(errorMessage)
    if (items.isEmpty()) return FriendSharedContentPhase.Empty
    val fromFriendCount = items.count { it.direction == "from_friend" }
    val toFriendCount = items.count { it.direction == "to_friend" }
    return FriendSharedContentPhase.Ready(
        items = items,
        fromFriendCount = fromFriendCount,
        toFriendCount = toFriendCount,
    )
}

internal fun buildFriendTimelineEntries(friend: FriendLiteItem): List<FriendTimelineEntry> {
    val locale = Locale.getDefault()
    return listOfNotNull(
        friend.friendshipCreatedAt?.let { raw ->
            formatCalendarDate(raw, locale)?.let { formatted ->
                FriendTimelineEntry(
                    id = "friendship",
                    labelRes = R.string.friends_detail_timeline_friendship,
                    value = formatted,
                )
            }
        },
        friend.lastActivityAt?.let { raw ->
            formatRelativeTimestamp(raw, locale)?.let { formatted ->
                FriendTimelineEntry(
                    id = "activity",
                    labelRes = R.string.friends_detail_timeline_activity,
                    value = formatted,
                )
            }
        },
        friend.lastInteractionAt?.let { raw ->
            formatRelativeTimestamp(raw, locale)?.let { formatted ->
                FriendTimelineEntry(
                    id = "interaction",
                    labelRes = R.string.friends_detail_timeline_interaction,
                    value = formatted,
                )
            }
        },
        friend.noteUpdatedAt?.let { raw ->
            formatRelativeTimestamp(raw, locale)?.let { formatted ->
                FriendTimelineEntry(
                    id = "note",
                    labelRes = R.string.friends_detail_timeline_note,
                    value = formatted,
                )
            }
        },
    )
}

internal fun sharedContentDisplayTitle(item: SocialHubSharedContentItemDto): String =
    item.title?.trim()?.takeIf { it.isNotEmpty() }
        ?: item.name?.trim()?.takeIf { it.isNotEmpty() }
        ?: item.content_type?.trim()?.takeIf { it.isNotEmpty() }
        ?: item.id

internal fun formatRelativeTimestamp(
    raw: String?,
    locale: Locale = Locale.getDefault(),
): String? {
    val epochMs = parseIsoEpochMs(raw) ?: return null
    val now = System.currentTimeMillis()
    val diffMinutes = Duration.ofMillis(now - epochMs).toMinutes()
    val absMinutes = kotlin.math.abs(diffMinutes)
    return when {
        absMinutes < 1 -> localizedRelative(locale, 0, RelativeUnit.MINUTE)
        absMinutes < 60 -> localizedRelative(locale, diffMinutes.toInt(), RelativeUnit.MINUTE)
        absMinutes < 60 * 24 -> localizedRelative(locale, (diffMinutes / 60).toInt(), RelativeUnit.HOUR)
        else -> localizedRelative(locale, (diffMinutes / (60 * 24)).toInt(), RelativeUnit.DAY)
    }
}

internal fun formatCalendarDate(
    raw: String?,
    locale: Locale = Locale.getDefault(),
): String? {
    val epochMs = parseIsoEpochMs(raw) ?: return null
    val formatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale)
    return runCatching {
        OffsetDateTime.parse(raw!!.trim()).format(formatter)
    }.getOrNull()
        ?: runCatching {
            java.time.Instant.ofEpochMilli(epochMs).atZone(java.time.ZoneId.systemDefault()).format(formatter)
        }.getOrNull()
}

private enum class RelativeUnit {
    MINUTE,
    HOUR,
    DAY,
}

private fun localizedRelative(
    locale: Locale,
    amount: Int,
    unit: RelativeUnit,
): String {
    val ru = locale.language == "ru"
    return when (unit) {
        RelativeUnit.MINUTE ->
            when {
                amount == 0 -> if (ru) "только что" else "just now"
                ru -> "$amount мин. назад"
                else -> "$amount min ago"
            }
        RelativeUnit.HOUR ->
            if (ru) "$amount ч. назад" else "$amount h ago"
        RelativeUnit.DAY ->
            if (ru) "$amount дн. назад" else "$amount d ago"
    }
}
