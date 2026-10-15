/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ugs-014: user-facing UGS error copy without raw enum/status/trace leakage.
 *
 * Invariants:
 * - Never return stack traces or HTTP status codes to end users.
 *
 * Related:
 * - UgsHubFeature.kt, UgsSongsScreen.kt
 */
package feature.ugs

internal fun mapUgsUserFacingError(raw: String?, fallbackRes: Int = R.string.ugs_error_generic): Int {
    val msg = raw?.trim()?.lowercase().orEmpty()
    if (msg.isEmpty()) return fallbackRes
    return when {
        msg.contains("timeout") || msg.contains("timed out") -> R.string.ugs_error_timeout
        msg.contains("network") || msg.contains("connect") || msg.contains("socket") -> R.string.ugs_error_network
        msg.contains("billing") || msg.contains("credit") || msg.contains("energy") || msg.contains("limit") ->
            R.string.ugs_error_billing
        msg.contains("policy") || msg.contains("topic") || msg.contains("profan") -> R.string.ugs_error_policy
        msg.contains("unauthorized") || msg.contains("401") || msg.contains("403") -> R.string.ugs_error_auth
        else -> fallbackRes
    }
}
