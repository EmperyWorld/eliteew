/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap analytics-002: privacy-safe telemetry wrapper — gates events and strips PII before Firebase.
 *
 * Invariants:
 * - Callers pass raw attributes; wrapper delegates scrubbing to MobileTelemetry.
 * - No-op when analytics consent flag is off (shell pref, default on).
 *
 * Related:
 * - MobileTelemetry.kt, MobileFeatureShellPreferences
 */
package world.empery.mobile.observability

import android.content.Context
import world.empery.mobile.shell.MobileFeatureShellPreferences

object MobileTelemetryPrivacy {
    fun trackScreen(context: Context, route: String) {
        if (!MobileFeatureShellPreferences.isAnalyticsEnabled(context)) return
        MobileTelemetry.trackScreen(route)
    }

    fun trackBusinessEvent(
        context: Context,
        name: String,
        attributes: Map<String, String> = emptyMap(),
    ) {
        if (!MobileFeatureShellPreferences.isAnalyticsEnabled(context)) return
        MobileTelemetry.trackBusinessEvent(name, attributes)
    }

    fun reportError(context: Context, throwable: Throwable, contextLabel: String) {
        if (!MobileFeatureShellPreferences.isAnalyticsEnabled(context)) return
        MobileTelemetry.reportError(throwable, contextLabel)
    }

    fun leaveBreadcrumb(context: Context, message: String) {
        if (!MobileFeatureShellPreferences.isAnalyticsEnabled(context)) return
        MobileTelemetry.leaveBreadcrumb(message)
    }
}
