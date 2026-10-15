/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical Firebase/analytics event name constants for MobileTelemetry.
 *
 * Invariants:
 * - snake_case event names; no PII in constant values.
 *
 * Related:
 * - MobileTelemetry.kt, MobileTelemetrySchemaTest.kt
 */
package world.empery.mobile.observability

object MobileTelemetryEventSchema {
    const val OPEN_SCREEN = "open_screen"
    const val FRIEND_REPORT = "friend_report"
}
