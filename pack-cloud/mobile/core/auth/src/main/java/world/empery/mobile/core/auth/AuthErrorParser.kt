/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse machine-readable auth error JSON (`reason`, `action`) from API HTTP bodies.
 *
 * Invariants:
 * - Never logs raw tokens from error payloads.
 *
 * Related:
 * - AuthRepository.refreshAccessToken, shared/api/core/auth_errors.py
 */
package world.empery.mobile.core.auth

object AuthErrorParser {
    const val REASON_SESSION_REPLACED = "session_replaced"
    const val REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED = "session_replace_confirmation_required"
    const val REASON_TOKEN_EXPIRED = "token_expired"
    const val REASON_INVALID_TOKEN = "invalid_token"

    private val REASON_FIELD = """"reason"\s*:\s*"([^"]+)"""".toRegex()
    private val WS_REASON_FIELD = """auth:([a-z_]+)""".toRegex(RegexOption.IGNORE_CASE)
    private val KV_REASON_FIELD = """reason\s*[=:]\s*([a-z_]+)""".toRegex(RegexOption.IGNORE_CASE)

    fun parseReason(errorBody: String?): String? {
        return parseReasonFromText(errorBody)
    }

    /**
     * Best-effort reason parser for both HTTP JSON bodies and Socket.IO connect errors.
     * Supports:
     * - `{"reason":"token_expired"}`
     * - `auth:session_replaced`
     * - `reason=session_replaced`
     */
    fun parseReasonFromText(rawText: String?): String? {
        val raw = rawText?.trim().orEmpty()
        if (raw.isEmpty()) return null
        REASON_FIELD.find(raw)?.groupValues?.getOrNull(1)?.trim()?.lowercase()?.let { reason ->
            if (reason.isNotBlank()) return reason
        }
        WS_REASON_FIELD.find(raw)?.groupValues?.getOrNull(1)?.trim()?.lowercase()?.let { reason ->
            if (reason.isNotBlank()) return reason
        }
        KV_REASON_FIELD.find(raw)?.groupValues?.getOrNull(1)?.trim()?.lowercase()?.let { reason ->
            if (reason.isNotBlank()) return reason
        }
        return null
    }
}
