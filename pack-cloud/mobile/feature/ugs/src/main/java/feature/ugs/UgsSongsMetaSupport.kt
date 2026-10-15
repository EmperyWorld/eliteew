/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Format song list metadata (date, size) for UgsSongsScreen rows.
 *
 * Invariants:
 * - created_at parsing is best-effort; null when unparseable.
 *
 * Related:
 * - UgsSongsScreen.kt, ContentLibraryPreviewSupport.kt
 */

package feature.ugs

import android.content.Context
import world.empery.mobile.core.network.api.UnifiedContentDto
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun formatSongDateLabel(createdAt: String?): String? {
    val raw = createdAt?.trim().orEmpty()
    if (raw.isEmpty()) return null
    return runCatching {
        val instant = Instant.parse(raw)
        DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault())
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }.getOrNull()
}

internal fun formatSongMetaLabel(
    context: Context,
    song: UnifiedContentDto,
): String {
    val parts = mutableListOf<String>()
    formatSongDateLabel(song.created_at)?.let(parts::add)
    formatContentFileSize(song.file_size)?.let(parts::add)
    if (parts.isEmpty()) {
        parts.add(context.getString(R.string.ugs_songs_track_source))
    }
    return parts.joinToString(" · ")
}

internal fun songDisplayName(
    context: Context,
    song: UnifiedContentDto,
): String = song.name.ifBlank { context.getString(R.string.ugs_songs_untitled) }
