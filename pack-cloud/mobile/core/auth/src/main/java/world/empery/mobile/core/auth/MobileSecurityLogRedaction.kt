/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap security-001: central token/secret redaction for logs and support bundles.
 *
 * Invariants:
 * - Never emit raw OAuth access/refresh tokens, JWTs, or Bearer headers in logs or exports.
 *
 * Related:
 * - OidcAuthManager.kt, MobileTelemetry.kt, RealtimeChatBridge.kt
 */
package world.empery.mobile.core.auth

private val BEARER_PATTERN = Regex("(?i)(Bearer\\s+)[A-Za-z0-9._~+/=-]+")
private val JWT_PATTERN = Regex("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
private val TOKEN_KV_PATTERN =
    Regex("(?i)(access_token|refresh_token|id_token|authorization)\\s*[:=]\\s*[^\\s,&\"']+")

/** security-001 */
fun redactSecretsForLog(message: String): String {
    var out = BEARER_PATTERN.replace(message) { m -> "${m.groupValues[1]}<redacted>" }
    out = TOKEN_KV_PATTERN.replace(out) { m ->
        val key = m.value.substringBefore('=').substringBefore(':').trim()
        "$key=<redacted>"
    }
    out = JWT_PATTERN.replace(out, "<redacted_jwt>")
    return out
}

/** security-004: redact sensitive keys from support bundle maps. */
fun redactSupportBundleEntries(entries: Map<String, String>): Map<String, String> =
    entries.mapValues { (key, value) ->
        val k = key.lowercase()
        if (
            k.contains("token") ||
            k.contains("secret") ||
            k.contains("password") ||
            k.contains("authorization") ||
            k.contains("cookie") ||
            k.contains("session")
        ) {
            "[REDACTED]"
        } else {
            redactSecretsForLog(value)
        }
    }
