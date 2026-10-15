/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse GAF structured message metadata and resolve centered system-event labels for mobile chat UI.
 *
 * Invariants:
 * - Only server-known metadata kinds are treated as system rows; mirrors desktop GAFChatMessageBubble.
 *
 * Related:
 * - GafChatSystemMessageRow.kt, documentation/product/GAF-CHAT-BACKEND.md
 */
package feature.chat

import android.content.Context
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.json.JSONObject

/** Known structured system payloads from GAF message metadata. */
sealed class GafMessageSystemPresentation {
    data class VideoCallEvent(
        val event: String,
        val durationSeconds: Int? = null,
        val missedReason: String? = null,
    ) : GafMessageSystemPresentation()

    data class OnboardingInstruction(
        val fallbackBody: String? = null,
    ) : GafMessageSystemPresentation()

    data class DesktopAppLink(
        val fallbackBody: String? = null,
    ) : GafMessageSystemPresentation()

    data class Generic(
        val kind: String,
        val fallbackBody: String? = null,
    ) : GafMessageSystemPresentation()
}

fun isGafSystemCenteredMessage(presentation: GafMessageSystemPresentation?): Boolean =
    presentation != null

/** Legacy mobile client duplicated server events as plain user messages (pre-0.2.126). */
private val LEGACY_POST_CALL_DURATION_MINUTES =
    Regex("""·\s*~(\d+)\s*мин""")

fun isLegacyPostCallSummaryBody(body: String): Boolean {
    val trimmed = body.trim()
    if (!trimmed.startsWith("📞")) return false
    return trimmed.contains("Видеозвонок") && trimmed.contains("завершён")
}

fun resolveGafMessageSystemPresentation(
    metadataJson: String?,
    body: String,
): GafMessageSystemPresentation? {
    parseGafMessageMetadataFromJsonString(metadataJson)?.let { return it }
    if (isLegacyPostCallSummaryBody(body)) {
        val minutes =
            LEGACY_POST_CALL_DURATION_MINUTES
                .find(body)
                ?.groupValues
                ?.getOrNull(1)
                ?.toIntOrNull()
        return GafMessageSystemPresentation.VideoCallEvent(
            event = "ended",
            durationSeconds = minutes?.coerceAtLeast(0)?.times(60),
        )
    }
    return null
}

fun parseGafMessageMetadataFromJsonString(raw: String?): GafMessageSystemPresentation? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    return runCatching {
        parseGafMessageMetadataFromJsonElement(JsonParser.parseString(trimmed))
    }.getOrNull()
}

fun parseGafMessageMetadataFromJsonElement(metadata: JsonElement?): GafMessageSystemPresentation? {
    if (metadata == null || metadata.isJsonNull || !metadata.isJsonObject) return null
    return parseGafMessageMetadataFromJsonObject(metadata.asJsonObject)
}

fun parseGafMessageMetadataFromJSONObject(metadata: JSONObject?): GafMessageSystemPresentation? {
    if (metadata == null || metadata.length() == 0) return null
    return runCatching {
        parseGafMessageMetadataFromJsonElement(JsonParser.parseString(metadata.toString()))
    }.getOrNull()
}

private fun parseGafMessageMetadataFromJsonObject(obj: JsonObject): GafMessageSystemPresentation? {
    val kind = obj.get("kind")?.asString?.trim().orEmpty()
    if (kind.isEmpty()) return null
    return when (kind) {
        "video_call_event" -> {
            val event = obj.get("event")?.asString?.trim().orEmpty()
            if (event !in VIDEO_CALL_EVENTS) return null
            val duration =
                obj.get("duration_seconds")
                    ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }
                    ?.asInt
                    ?.coerceAtLeast(0)
            val missedReason = obj.get("missed_reason")?.asString?.trim()?.takeIf { it.isNotEmpty() }
            GafMessageSystemPresentation.VideoCallEvent(
                event = event,
                durationSeconds = duration,
                missedReason = missedReason,
            )
        }
        "onboarding_instruction" ->
            GafMessageSystemPresentation.OnboardingInstruction()
        "desktop_app_link" ->
            GafMessageSystemPresentation.DesktopAppLink()
        else ->
            GafMessageSystemPresentation.Generic(kind = kind)
    }
}

fun gafMessageMetadataToJsonString(metadata: JsonElement?): String? {
    if (metadata == null || metadata.isJsonNull) return null
    if (metadata.isJsonObject && metadata.asJsonObject.size() == 0) return null
    if (metadata.isJsonArray && metadata.asJsonArray.size() == 0) return null
    return metadata.toString()
}

fun resolveGafSystemMessageLabel(
    context: Context,
    presentation: GafMessageSystemPresentation,
    fallbackBody: String = "",
): String {
    if (isLegacyPostCallSummaryBody(fallbackBody)) {
        return fallbackBody.trim()
    }
    return when (presentation) {
        is GafMessageSystemPresentation.VideoCallEvent -> {
            val missedReason = presentation.missedReason
            if (presentation.event == "missed" && !missedReason.isNullOrBlank()) {
                when (missedReason) {
                    "no_answer" -> context.getString(R.string.chat_video_call_event_missed_reason_no_answer)
                    "callee_unreachable" ->
                        context.getString(R.string.chat_video_call_event_missed_reason_callee_unreachable)
                    "callee_mobile_unreachable" ->
                        context.getString(R.string.chat_video_call_event_missed_reason_callee_mobile_unreachable)
                    "declined" -> context.getString(R.string.chat_video_call_event_missed_reason_declined)
                    "caller_cancelled" ->
                        context.getString(R.string.chat_video_call_event_missed_reason_caller_cancelled)
                    else -> context.getString(R.string.chat_video_call_event_missed)
                }
            } else {
                when (presentation.event) {
                    "ringing" -> context.getString(R.string.chat_video_call_event_ringing)
                    "accepted" -> context.getString(R.string.chat_video_call_event_accepted)
                    "ended" -> context.getString(R.string.chat_video_call_event_ended)
                    "missed" -> context.getString(R.string.chat_video_call_event_missed)
                    else ->
                        fallbackBody.ifBlank { context.getString(R.string.chat_system_message_fallback) }
                }
            }
        }
        is GafMessageSystemPresentation.OnboardingInstruction ->
            fallbackBody.ifBlank { context.getString(R.string.chat_system_message_onboarding) }
        is GafMessageSystemPresentation.DesktopAppLink ->
            fallbackBody.ifBlank { context.getString(R.string.chat_system_message_desktop_link) }
        is GafMessageSystemPresentation.Generic ->
            fallbackBody.ifBlank { context.getString(R.string.chat_system_message_fallback) }
    }
}

fun formatGafVideoCallDuration(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val hours = safe / 3600
    val minutes = (safe % 3600) / 60
    val secs = safe % 60
    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, secs)
    } else {
        String.format("%d:%02d", minutes, secs)
    }
}

private val VIDEO_CALL_EVENTS = setOf("ringing", "accepted", "ended", "missed")
