/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile thin-client helpers for MusicForge create+poll (SFT TOP canon).
 *
 * Invariants:
 * - Public create body exposes only idea/language/style_hint/constraints/duration/mode_key — no workflow flags.
 * - Poll until terminal status; failed/cancelled/timeout throw with operator-visible message.
 *
 * Related:
 * - UgsSongsScreen.kt, MusicForgeApiContracts.kt
 * - documentation/product/MUSIC-FORGE-APP.md
 */
package feature.ugs

import kotlinx.coroutines.delay
import world.empery.mobile.core.network.api.MusicForgeApi
import world.empery.mobile.core.network.api.MusicForgeModeCapability
import world.empery.mobile.core.network.api.MusicForgeRunCreateRequest
import world.empery.mobile.core.network.api.MusicForgeRunResponse
import world.empery.mobile.core.network.api.UnifiedContentDto
import java.util.UUID

const val MUSIC_FORGE_MOBILE_DURATION_SECONDS = 220
const val MUSIC_FORGE_POLL_MS_MIN = 4_000L
const val MUSIC_FORGE_POLL_MS_MAX = 15_000L
/** @deprecated Prefer [MUSIC_FORGE_POLL_MS_MIN] — kept for call-site overrides. */
const val MUSIC_FORGE_POLL_MS = MUSIC_FORGE_POLL_MS_MIN
const val MUSIC_FORGE_POLL_TIMEOUT_MS = 1_860_000L

fun nextMusicForgePollDelayMs(currentMs: Long): Long {
    val base =
        if (currentMs > 0L) {
            currentMs
        } else {
            MUSIC_FORGE_POLL_MS_MIN
        }
    return minOf(
        MUSIC_FORGE_POLL_MS_MAX,
        maxOf(MUSIC_FORGE_POLL_MS_MIN, kotlin.math.round(base * 1.5).toLong()),
    )
}

fun musicForgeLanguageForMobile(uiLanguage: String): String =
    when (uiLanguage.trim().lowercase()) {
        "ru", "en" -> uiLanguage.trim().lowercase()
        else -> "auto"
    }

fun musicForgeConstraintsForMobile(
    vocal: String,
    uiLanguage: String,
): String {
    val v = vocal.trim().lowercase().ifBlank { "female" }
    val langNote =
        when (uiLanguage.trim().lowercase()) {
            "es" -> " Preferred sung language: Spanish."
            "fr" -> " Preferred sung language: French."
            else -> ""
        }
    return "Lead vocal: $v. Full TOP song; clear sung words; no wordless wailing.$langNote"
}

fun musicForgeTasteLikeCount(raw: Int?): Int = (raw ?: 0).coerceAtLeast(0)

fun musicForgeRunIdFromMetadata(metadata: Map<String, Any?>?): String? {
    val raw = metadata?.get("music_forge_run_id")?.toString()?.trim().orEmpty()
    return raw.takeIf { it.isNotEmpty() }
}

fun musicForgeModeLabel(
    mode: MusicForgeModeCapability,
    uiLanguage: String,
): String {
    val ru = mode.label_ru.trim()
    val en = mode.label_en.trim()
    val preferRu = uiLanguage.trim().lowercase() == "ru"
    val primary = if (preferRu) ru.ifBlank { en } else en.ifBlank { ru }
    return primary.ifBlank { mode.mode_key.trim() }.ifBlank { "mode" }
}

fun resolveMusicForgeModeIndex(
    modes: List<MusicForgeModeCapability>,
    defaultModeKey: String?,
): Int {
    if (modes.isEmpty()) return 0
    val byDefaultKey =
        defaultModeKey
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?.let { key -> modes.indexOfFirst { it.mode_key == key } }
            ?.takeIf { it >= 0 }
    if (byDefaultKey != null) return byDefaultKey
    val byFlag = modes.indexOfFirst { it.is_default }
    return if (byFlag >= 0) byFlag else 0
}

fun isMusicForgeTerminalStatus(status: String?): Boolean =
    when (status?.trim()?.lowercase()) {
        "completed", "failed", "cancelled" -> true
        else -> false
    }

fun musicForgeErrorMessage(run: MusicForgeRunResponse): String {
    val payload = run.error_payload.orEmpty()
    val message = payload["message"]?.toString()?.trim().orEmpty()
    if (message.isNotEmpty()) return message
    val step = payload["step"]?.toString()?.trim().orEmpty()
    if (step.isNotEmpty()) return "music_forge_failed:$step"
    return "music_forge_${run.status}"
}

fun mergeSongHistory(
    forgeSongs: List<UnifiedContentDto>,
    legacySongs: List<UnifiedContentDto>,
    maxItems: Int = 200,
): List<UnifiedContentDto> {
    val byId = LinkedHashMap<String, UnifiedContentDto>()
    (forgeSongs + legacySongs).forEach { item ->
        byId.putIfAbsent(item.id, item)
    }
    return byId.values
        .sortedWith(
            compareByDescending<UnifiedContentDto> { it.created_at.orEmpty() }
                .thenByDescending { it.id },
        )
        .take(maxItems.coerceAtLeast(1))
}

suspend fun runMusicForgeSongGeneration(
    api: MusicForgeApi,
    topic: String,
    styleKey: String,
    language: String,
    vocal: String,
    modeKey: String? = null,
    durationSeconds: Int = MUSIC_FORGE_MOBILE_DURATION_SECONDS,
    pollMs: Long = MUSIC_FORGE_POLL_MS_MIN,
    timeoutMs: Long = MUSIC_FORGE_POLL_TIMEOUT_MS,
): MusicForgeRunResponse {
    val forgeLanguage = musicForgeLanguageForMobile(language)
    val created =
        api.createRun(
            MusicForgeRunCreateRequest(
                idea = topic.trim(),
                language = forgeLanguage,
                style_hint = styleKey.trim().ifBlank { null },
                constraints = musicForgeConstraintsForMobile(vocal, language),
                duration_seconds = durationSeconds.coerceIn(60, 240),
                mode_key = modeKey?.trim()?.takeIf { it.isNotEmpty() },
                idempotency_key = UUID.randomUUID().toString(),
            ),
        )
    val runId = created.run_id.trim()
    if (runId.isEmpty()) {
        error("music_forge_empty_run_id")
    }

    val deadline = System.currentTimeMillis() + timeoutMs
    var last: MusicForgeRunResponse? = null
    var pollDelayMs = pollMs.coerceAtLeast(MUSIC_FORGE_POLL_MS_MIN)
    while (System.currentTimeMillis() < deadline) {
        val run = api.getRun(runId)
        last = run
        if (isMusicForgeTerminalStatus(run.status)) {
            when (run.status.trim().lowercase()) {
                "completed" -> {
                    if (run.content_id.isNullOrBlank()) {
                        error("music_forge_completed_without_content")
                    }
                    return run
                }
                "failed", "cancelled" -> error(musicForgeErrorMessage(run))
            }
        }
        delay(pollDelayMs)
        pollDelayMs = nextMusicForgePollDelayMs(pollDelayMs)
    }
    error("music_forge_timeout:${last?.status ?: "unknown"}")
}

suspend fun runMusicForgeLyricsRewrite(
    api: MusicForgeApi,
    sourceRunId: String,
    pollMs: Long = MUSIC_FORGE_POLL_MS_MIN,
    timeoutMs: Long = MUSIC_FORGE_POLL_TIMEOUT_MS,
): MusicForgeRunResponse {
    val sourceId = sourceRunId.trim()
    if (sourceId.isEmpty()) {
        error("music_forge_empty_source_run_id")
    }
    val created = api.rewriteLyrics(sourceId)
    val runId = created.run_id.trim()
    if (runId.isEmpty()) {
        error("music_forge_empty_run_id")
    }

    val deadline = System.currentTimeMillis() + timeoutMs
    var last: MusicForgeRunResponse? = null
    var pollDelayMs = pollMs.coerceAtLeast(MUSIC_FORGE_POLL_MS_MIN)
    while (System.currentTimeMillis() < deadline) {
        val run = api.getRun(runId)
        last = run
        if (isMusicForgeTerminalStatus(run.status)) {
            when (run.status.trim().lowercase()) {
                "completed" -> {
                    if (run.content_id.isNullOrBlank()) {
                        error("music_forge_completed_without_content")
                    }
                    return run
                }
                "failed", "cancelled" -> error(musicForgeErrorMessage(run))
            }
        }
        delay(pollDelayMs)
        pollDelayMs = nextMusicForgePollDelayMs(pollDelayMs)
    }
    error("music_forge_timeout:${last?.status ?: "unknown"}")
}
