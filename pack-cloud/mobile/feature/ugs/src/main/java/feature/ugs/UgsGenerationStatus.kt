/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ugs-002/003: unified generation status model and history filters for UGS Hub screens.
 *
 * Invariants:
 * - Unknown backend statuses map to FAILED, not crash.
 *
 * Related:
 * - UgsHubFeature.kt, UgsSongsScreen.kt, UgsImagesScreen.kt
 */
package feature.ugs

/** ugs-002 */
enum class UgsGenerationStatus(val id: String) {
    QUEUED("queued"),
    RUNNING("running"),
    READY("ready"),
    FAILED("failed"),
    EXPIRED("expired"),
    DOWNLOADED("downloaded"),
}

enum class UgsGenerationType(val id: String) {
    AI_CHAT("ai_chat"),
    IMAGE("image"),
    SONG("song"),
    PRESENTATION("presentation"),
}

internal fun parseUgsGenerationStatus(raw: String?): UgsGenerationStatus {
    val key = raw?.trim()?.lowercase().orEmpty()
    return UgsGenerationStatus.entries.firstOrNull { it.id == key }
        ?: when {
            key.contains("queue") || key.contains("pending") -> UgsGenerationStatus.QUEUED
            key.contains("run") || key.contains("progress") || key.contains("generat") -> UgsGenerationStatus.RUNNING
            key.contains("ready") || key.contains("done") || key.contains("complete") -> UgsGenerationStatus.READY
            key.contains("expire") -> UgsGenerationStatus.EXPIRED
            key.contains("download") -> UgsGenerationStatus.DOWNLOADED
            else -> UgsGenerationStatus.FAILED
        }
}

internal fun parseUgsGenerationType(raw: String?): UgsGenerationType? =
    UgsGenerationType.entries.firstOrNull { it.id == raw?.trim()?.lowercase() }

internal fun matchesUgsHistoryFilters(
    type: UgsGenerationType,
    status: UgsGenerationStatus,
    typeFilter: UgsGenerationType?,
    statusFilter: UgsGenerationStatus?,
): Boolean {
    if (typeFilter != null && typeFilter != type) return false
    if (statusFilter != null && statusFilter != status) return false
    return true
}
