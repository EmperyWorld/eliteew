/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap analytics-001…003: Firebase Analytics/Crashlytics with PII-safe schema and breadcrumbs.
 *
 * Invariants:
 * - Event names and params follow [MobileTelemetryEventSchema].
 * - Raw tokens never logged.
 *
 * Related:
 * - MobileTelemetryPrivacy.kt, MobileSecurityLogRedaction.kt
 */
package world.empery.mobile.observability

import android.os.Bundle
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.ktx.Firebase
import com.google.firebase.crashlytics.FirebaseCrashlytics
import world.empery.mobile.BuildConfig
import java.util.concurrent.ConcurrentHashMap

/**
 * Central entry for Firebase Analytics / Crashlytics with PII-safe defaults,
 * consistent dimension tags, light rate limiting, and local logs only in [BuildConfig.DEBUG].
 */
object MobileTelemetry {
    private const val TAG = "MobileTelemetry"
    private const val ANALYTICS_STRING_MAX = 100
    private const val ANALYTICS_EVENT_NAME_MAX = 40
    private const val ANALYTICS_MAX_PARAMS = 25
    private const val SCREEN_DEDUPE_MS = 2_000L
    private const val BUSINESS_DEDUPE_MS = 800L
    private const val RATE_WINDOW_MS = 60_000L
    private const val RATE_MAX_EVENTS_PER_WINDOW = 120

    private val devLog: Boolean = BuildConfig.DEBUG

    private val analytics: FirebaseAnalytics? by lazy {
        runCatching {
            FirebaseApp.getInstance()
            Firebase.analytics
        }.getOrNull()
    }

    private val crashlytics: FirebaseCrashlytics? by lazy {
        runCatching {
            FirebaseApp.getInstance()
            FirebaseCrashlytics.getInstance()
        }.getOrNull()
    }

    @Volatile
    private var lastScreenRoute: String? = null

    @Volatile
    private var lastScreenAt: Long = 0L

    private val businessDedupe = ConcurrentHashMap<String, Long>()
    private val rateLock = Any()
    private var rateWindowStartMs: Long = 0L
    private var rateWindowCount: Int = 0

    private val sensitiveKeyFragments: Array<String> = arrayOf(
        "password",
        "passwd",
        "secret",
        "token",
        "oauth",
        "bearer",
        "credential",
        "email",
        "mail",
        "phone",
        "ssn",
        "card",
        "cvv",
        "session",
        "cookie",
        "apikey",
        "api_key",
        "authorization",
        "iban",
        "otp",
    )

    private val jwtPattern = Regex("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
    private val longHexPattern = Regex("^[a-fA-F0-9]{32,}$")
    private val ipv4Pattern = Regex(
        "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b",
    )
    private val uuidPattern = Regex(
        "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b",
    )

    fun trackScreen(route: String) {
        val now = System.currentTimeMillis()
        synchronized(this) {
            if (route == lastScreenRoute && now - lastScreenAt < SCREEN_DEDUPE_MS) return
            lastScreenRoute = route
            lastScreenAt = now
        }
        val safeRoute = scrubRoute(route)
        val bundle = bundleForEvent(mapOf("route" to safeRoute))
        sendAnalyticsEvent(MobileTelemetryEventSchema.OPEN_SCREEN, bundle) {
            if (devLog) Log.d(TAG, "screen route=$safeRoute (firebase unavailable)")
        }
    }

    fun trackBusinessEvent(name: String, attributes: Map<String, String> = emptyMap()) {
        val dedupeKey = name + "\u0000" + attributes.entries.sortedBy { it.key }
            .joinToString("\u0000") { "${it.key}=${it.value}" }
        val now = System.currentTimeMillis()
        synchronized(businessDedupe) {
            val prev = businessDedupe[dedupeKey]
            if (prev != null && now - prev < BUSINESS_DEDUPE_MS) return
            businessDedupe.entries.removeIf { now - it.value > 60_000L }
            businessDedupe[dedupeKey] = now
        }
        val eventName = sanitizeEventName(name)
        val bundle = bundleForEvent(attributes)
        val sent = sendAnalyticsEvent(eventName, bundle) {
            if (devLog) Log.d(TAG, "event=$eventName attrs redacted (firebase unavailable)")
        }
        if (devLog && sent) {
            Log.i(TAG, "event=$eventName params=${summarizeForLog(attributes)}")
        }
    }


    /** analytics-003: Crashlytics breadcrumb (scrubbed). */
    fun leaveBreadcrumb(message: String) {
        val safe = scrubFreeText(message, ANALYTICS_STRING_MAX)
        crashlytics?.log("breadcrumb: $safe")
        if (devLog) Log.d(TAG, "breadcrumb: $safe")
    }

    fun reportError(throwable: Throwable, context: String) {
        val safeContext = scrubFreeText(context, ANALYTICS_STRING_MAX)
        crashlytics?.log(safeContext)
        crashlytics?.recordException(throwable)
        if (devLog && crashlytics == null) {
            Log.w(TAG, "crashlytics unavailable: $safeContext", throwable)
        }
    }

    /** @return true if an event was passed to Firebase (not rate-limited and client non-null). */
    private fun sendAnalyticsEvent(eventName: String, bundle: Bundle, onSkipped: () -> Unit): Boolean {
        if (!allowAnalyticsEvent()) {
            if (devLog) Log.d(TAG, "rate limited, skip event=$eventName")
            return false
        }
        val client = analytics
        return if (client != null) {
            client.logEvent(eventName, bundle)
            true
        } else {
            onSkipped()
            false
        }
    }

    private fun allowAnalyticsEvent(): Boolean {
        synchronized(rateLock) {
            val now = System.currentTimeMillis()
            if (now - rateWindowStartMs > RATE_WINDOW_MS) {
                rateWindowStartMs = now
                rateWindowCount = 0
            }
            if (rateWindowCount >= RATE_MAX_EVENTS_PER_WINDOW) return false
            rateWindowCount++
            return true
        }
    }

    private fun bundleForEvent(userParams: Map<String, String>): Bundle {
        val out = LinkedHashMap<String, String>(ANALYTICS_MAX_PARAMS)
        baseTags().forEach { (k, v) ->
            if (out.size < ANALYTICS_MAX_PARAMS) {
                out[sanitizeParamName(k)] = clampString(scrubValue(k, v))
            }
        }
        userParams.forEach { (rawKey, rawVal) ->
            if (out.size >= ANALYTICS_MAX_PARAMS) return@forEach
            val key = sanitizeParamName(rawKey)
            if (key.isEmpty()) return@forEach
            if (isSensitiveKey(key)) {
                out[key] = "[REDACTED]"
            } else {
                out[key] = clampString(scrubValue(key, rawVal))
            }
        }
        return Bundle().apply {
            out.forEach { (k, v) -> putString(k, v) }
        }
    }

    private fun baseTags(): Map<String, String> = mapOf(
        "ew_flavor" to BuildConfig.FLAVOR,
        "ew_build" to BuildConfig.BUILD_TYPE,
        "ew_ver" to BuildConfig.VERSION_NAME,
    )

    private fun sanitizeEventName(raw: String): String {
        val lower = raw.lowercase().replace(Regex("[^a-z0-9_]"), "_")
            .trim('_')
            .ifEmpty { "event" }
        return lower.take(ANALYTICS_EVENT_NAME_MAX)
    }

    private fun sanitizeParamName(raw: String): String {
        val lower = raw.lowercase().replace(Regex("[^a-z0-9_]"), "_")
            .trim('_')
        return lower.take(ANALYTICS_EVENT_NAME_MAX)
    }

    private fun isSensitiveKey(key: String): Boolean {
        val k = key.lowercase()
        return sensitiveKeyFragments.any { fragment -> k.contains(fragment) }
    }

    private fun scrubValue(paramKey: String, value: String): String {
        if (isSensitiveKey(paramKey)) return "[REDACTED]"
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return ""
        if (looksLikeEmail(trimmed)) return "[REDACTED_EMAIL]"
        if (jwtPattern.matches(trimmed)) return "[REDACTED_JWT]"
        if (longHexPattern.matches(trimmed)) return "[REDACTED_SECRET]"
        return redactPatterns(trimmed)
    }

    private fun scrubRoute(route: String): String {
        val noQuery = route.substringBefore('?').substringBefore('#')
        return clampString(scrubFreeText(noQuery, ANALYTICS_STRING_MAX))
    }

    private fun scrubFreeText(text: String, maxLen: Int): String {
        var s = text
        if (looksLikeEmail(s)) s = "[REDACTED_EMAIL]"
        else if (jwtPattern.matches(s.trim())) s = "[REDACTED_JWT]"
        else s = redactPatterns(s)
        return s.take(maxLen)
    }

    private fun redactPatterns(s: String): String {
        var out = ipv4Pattern.replace(s, "[REDACTED_IP]")
        out = uuidPattern.replace(out, "[REDACTED_ID]")
        return out
    }

    private fun looksLikeEmail(s: String): Boolean {
        val t = s.trim()
        val at = t.indexOf('@')
        if (at <= 0 || at == t.length - 1) return false
        return t.lastIndexOf('.') > at
    }

    private fun clampString(s: String): String =
        if (s.length <= ANALYTICS_STRING_MAX) s else s.take(ANALYTICS_STRING_MAX - 3) + "..."

    private fun summarizeForLog(attrs: Map<String, String>): String =
        attrs.entries.joinToString(", ") { (k, v) ->
            val sk = sanitizeParamName(k)
            "$sk=${scrubValue(sk, v)}"
        }
}
