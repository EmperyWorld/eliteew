/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Aggregate OTA release notes when the user skips multiple versionCode steps.
 *
 * Invariants:
 * - User-facing aggregated text is Russian plain language; entries sorted by version_code ascending.
 * - Mirrors api.services.mobile_apk_release_notes for offline fallback.
 *
 * Related:
 * - ProfileTabViewModel, MobileAppApiContracts, RELEASE-NOTES-history.ru.json
 */
package feature.profile

data class OtaReleaseNotesEntry(
    val versionCode: Int,
    val versionName: String,
    val releaseNotes: String,
)

/**
 * Build notes shown in Profile → Updates when [serverVersionCode] is newer than [installedVersionCode].
 * Prefer server-pre-aggregated [currentReleaseNotes] from overview when present.
 */
fun aggregateOtaReleaseNotes(
    installedVersionCode: Int,
    serverVersionCode: Int?,
    currentReleaseNotes: String?,
    history: List<OtaReleaseNotesEntry>?,
): String? {
    if (serverVersionCode == null || serverVersionCode <= installedVersionCode) return null
    val delta = serverVersionCode - installedVersionCode
    val current = currentReleaseNotes?.trim()?.takeIf { it.isNotEmpty() }
    var normalizedHistory =
        history
            ?.filter { entry -> entry.versionCode in (installedVersionCode + 1)..serverVersionCode }
            ?.distinctBy { it.versionCode }
            ?.sortedBy { it.versionCode }
            .orEmpty()
    if (normalizedHistory.isEmpty() && current != null) {
        normalizedHistory =
            listOf(
                OtaReleaseNotesEntry(
                    versionCode = serverVersionCode,
                    versionName = serverVersionCode.toString(),
                    releaseNotes = current,
                ),
            )
    } else if (
        current != null &&
        normalizedHistory.none { entry -> entry.versionCode == serverVersionCode }
    ) {
        normalizedHistory =
            normalizedHistory +
                OtaReleaseNotesEntry(
                    versionCode = serverVersionCode,
                    versionName = serverVersionCode.toString(),
                    releaseNotes = current,
                )
    }
    if (delta <= 1 || normalizedHistory.isEmpty()) {
        return current
    }
    val blocks =
        normalizedHistory.map { entry ->
            val body = entry.releaseNotes.trim()
            if (body.isEmpty()) {
                "Версия ${entry.versionName}"
            } else {
                "Версия ${entry.versionName}\n$body"
            }
        }
    return buildString {
        append("Вы пропустили несколько обновлений. Что изменилось:\n\n")
        blocks.forEachIndexed { index, block ->
            if (index > 0) append("\n\n")
            append(block)
        }
    }.trim()
}

fun resolveOtaReleaseNotesForProfile(
    installedVersionCode: Int,
    overview: world.empery.mobile.core.network.api.MobileAppOverviewResponse,
): String? {
    val serverNotes = overview.releaseNotes?.trim()?.takeIf { it.isNotEmpty() }
    val history =
        overview.releaseNotesHistory?.map { entry ->
            OtaReleaseNotesEntry(
                versionCode = entry.versionCode,
                versionName = entry.versionName,
                releaseNotes = entry.releaseNotes,
            )
        }
    val clientAggregated =
        aggregateOtaReleaseNotes(
            installedVersionCode = installedVersionCode,
            serverVersionCode = overview.versionCode,
            currentReleaseNotes = overview.releaseNotes,
            history = history,
        )
    return when {
        serverNotes?.startsWith("Вы пропустили несколько обновлений") == true -> serverNotes
        clientAggregated != null -> clientAggregated
        else -> serverNotes
    }
}
