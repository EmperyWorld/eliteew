/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub UI state model shared by repository, screen, and ViewModel.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubLogic.kt
 */
package feature.desktop

import world.empery.mobile.core.network.api.DesktopConfigDto
import world.empery.mobile.core.network.api.DesktopFavoriteDto
import world.empery.mobile.core.network.api.DesktopShellStateDto
import world.empery.mobile.core.network.api.DesktopStoreAppDto
import world.empery.mobile.core.network.api.DesktopWidgetNoteDto
import world.empery.mobile.core.network.api.DesktopWidgetTodoDto

data class DesktopHubUiState(
    val config: DesktopConfigDto? = null,
    val shellState: DesktopShellStateDto? = null,
    val storeApps: List<DesktopStoreAppDto> = emptyList(),
    val installedAppIds: Set<String> = emptySet(),
    val widgetNotes: List<DesktopWidgetNoteDto> = emptyList(),
    val widgetTodos: List<DesktopWidgetTodoDto> = emptyList(),
    val favorites: List<DesktopFavoriteDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    /** desktop-009 */
    val handoffDraft: DesktopHandoffDraft? = null,
    /** Scroll target after push/deeplink section focus. */
    val focusSectionId: DesktopHubSectionId? = null,
)
