/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap shell helpers (a11y-001, i18n, analytics shell state): bottom-nav TalkBack labels, tab CD builder.
 *
 * Invariants:
 * - Bottom-nav content descriptions include selection state and badge context.
 * - Shell prefs hold QA toggles only; no secrets.
 *
 * Related:
 * - MobileFeatureShellPreferences, MainActivity.kt, MobileA11ySupport.kt
 */
package world.empery.mobile.shell

/** a11y-001: build TalkBack-safe bottom-nav contentDescription. */
fun bottomNavTabContentDescription(
    tabTitle: String,
    selected: Boolean,
    selectedTemplate: String,
    unselectedTemplate: String,
    updateBadgeLabel: String? = null,
    unreadCount: Int = 0,
    unreadTemplate: ((Int) -> String)? = null,
): String {
    val title = tabTitle.trim()
    if (!updateBadgeLabel.isNullOrBlank()) return updateBadgeLabel
    if (unreadCount > 0 && unreadTemplate != null) return unreadTemplate(unreadCount)
    return if (selected) {
        selectedTemplate.format(title)
    } else {
        unselectedTemplate.format(title)
    }
}

/** analytics-004: aggregate runtime diagnostics rows for Profile (pure data). */
data class RuntimeDiagnosticsRow(
    val label: String,
    val value: String,
    val sensitive: Boolean = false,
)

fun buildRuntimeDiagnosticsRows(
    flavor: String,
    buildType: String,
    versionName: String,
    versionCode: Int,
    apiRootHost: String,
    socketState: String,
    reduceMotion: Boolean,
    fontStress: Boolean,
    strictModeDebug: Boolean,
): List<RuntimeDiagnosticsRow> =
    listOf(
        RuntimeDiagnosticsRow("flavor", flavor),
        RuntimeDiagnosticsRow("build", buildType),
        RuntimeDiagnosticsRow("version", "$versionName ($versionCode)"),
        RuntimeDiagnosticsRow("api_host", apiRootHost),
        RuntimeDiagnosticsRow("socket", socketState),
        RuntimeDiagnosticsRow("reduce_motion", reduceMotion.toString()),
        RuntimeDiagnosticsRow("font_stress", fontStress.toString()),
        RuntimeDiagnosticsRow("strict_mode", strictModeDebug.toString()),
    )
