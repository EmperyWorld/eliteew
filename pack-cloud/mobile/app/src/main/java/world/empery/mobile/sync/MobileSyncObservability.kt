/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * offline-005: persist last background sync result for Profile diagnostics and offline banner.
 *
 * Invariants:
 * - No secrets in persisted sync metadata.
 *
 * Related:
 * - BackgroundSyncWorker, ProfileControlCenterSections
 */
package world.empery.mobile.sync

import android.content.Context

data class MobileSyncObservabilityState(
    val lastSuccessEpochMs: Long = 0L,
    val lastAttemptEpochMs: Long = 0L,
    val lastScope: String = "all",
    val lastResult: String = "unknown",
    val lastError: String? = null,
    val nextAttemptHintEpochMs: Long = 0L,
)

object MobileSyncObservability {
    private const val PREFS = "world.empery.mobile.sync.observability"
    private const val KEY_SUCCESS = "last_success_ms"
    private const val KEY_ATTEMPT = "last_attempt_ms"
    private const val KEY_SCOPE = "last_scope"
    private const val KEY_RESULT = "last_result"
    private const val KEY_ERROR = "last_error"
    private const val KEY_NEXT = "next_attempt_ms"

    fun read(context: Context): MobileSyncObservabilityState {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return MobileSyncObservabilityState(
            lastSuccessEpochMs = p.getLong(KEY_SUCCESS, 0L),
            lastAttemptEpochMs = p.getLong(KEY_ATTEMPT, 0L),
            lastScope = p.getString(KEY_SCOPE, "all") ?: "all",
            lastResult = p.getString(KEY_RESULT, "unknown") ?: "unknown",
            lastError = p.getString(KEY_ERROR, null),
            nextAttemptHintEpochMs = p.getLong(KEY_NEXT, 0L),
        )
    }

    fun markAttempt(context: Context, scope: String) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_ATTEMPT, System.currentTimeMillis())
            .putString(KEY_SCOPE, scope)
            .putString(KEY_RESULT, "running")
            .remove(KEY_ERROR)
            .apply()
    }

    fun markSuccess(context: Context, scope: String, cooldownMs: Long) {
        val now = System.currentTimeMillis()
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_SUCCESS, now)
            .putLong(KEY_ATTEMPT, now)
            .putString(KEY_SCOPE, scope)
            .putString(KEY_RESULT, "ok")
            .remove(KEY_ERROR)
            .putLong(KEY_NEXT, now + cooldownMs)
            .apply()
    }

    fun markFailure(context: Context, scope: String, error: String?, retryDelayMs: Long) {
        val now = System.currentTimeMillis()
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_ATTEMPT, now)
            .putString(KEY_SCOPE, scope)
            .putString(KEY_RESULT, "failed")
            .putString(KEY_ERROR, error?.take(240))
            .putLong(KEY_NEXT, now + retryDelayMs)
            .apply()
    }
}
