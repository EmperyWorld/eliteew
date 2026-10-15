/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps push/deeplink Desktop Hub section keys to scroll targets on the hub screen.
 *
 * Invariants:
 * - Unknown section keys return null (open hub root only).
 * - [lazyListIndex] matches item order in [DesktopHubScreen] LazyColumn.
 *
 * Related:
 * - DesktopHubTabViewModel, MobileDeepLinks.kt
 */
package feature.desktop

enum class DesktopHubSectionId(val lazyListIndex: Int) {
    REMOTE_DASHBOARD(DesktopHubLazyColumnIndices.REMOTE_DASHBOARD),
    SHELL_STATE(DesktopHubLazyColumnIndices.SHELL_STATE),
    EWA(DesktopHubLazyColumnIndices.EWA),
    HANDOFF(DesktopHubLazyColumnIndices.HANDOFF),
    CONFIG(DesktopHubLazyColumnIndices.CONFIG),
    NOTES(DesktopHubLazyColumnIndices.NOTES),
    TODOS(DesktopHubLazyColumnIndices.TODOS),
    FAVORITES(DesktopHubLazyColumnIndices.FAVORITES),
    STORE(DesktopHubLazyColumnIndices.STORE),
}

/** User-facing CRUD sections surfaced in wide-layout quick jump row. */
val DESKTOP_HUB_QUICK_JUMP_SECTIONS: List<DesktopHubSectionId> =
    listOf(
        DesktopHubSectionId.CONFIG,
        DesktopHubSectionId.NOTES,
        DesktopHubSectionId.TODOS,
        DesktopHubSectionId.FAVORITES,
        DesktopHubSectionId.STORE,
    )

fun resolveDesktopHubSectionFromKey(raw: String?): DesktopHubSectionId? =
    when (raw?.trim()?.lowercase()) {
        "dashboard", "remote", "overview" -> DesktopHubSectionId.REMOTE_DASHBOARD
        "shell", "shell_state", "shell-state" -> DesktopHubSectionId.SHELL_STATE
        "ewa", "companion" -> DesktopHubSectionId.EWA
        "handoff" -> DesktopHubSectionId.HANDOFF
        "config", "configuration", "settings", "theme" -> DesktopHubSectionId.CONFIG
        "notes", "note" -> DesktopHubSectionId.NOTES
        "todos", "todo", "tasks" -> DesktopHubSectionId.TODOS
        "favorites", "favorite", "bookmarks" -> DesktopHubSectionId.FAVORITES
        "store", "apps", "app_store", "app-store" -> DesktopHubSectionId.STORE
        else -> null
    }
