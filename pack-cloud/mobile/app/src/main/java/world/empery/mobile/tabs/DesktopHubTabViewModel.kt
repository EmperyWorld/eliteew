package world.empery.mobile.tabs

import android.app.Application
import androidx.lifecycle.viewModelScope
import feature.desktop.DesktopHubUiState
import feature.desktop.resolveDesktopHandoffDraft
import feature.desktop.resolveDesktopHubSectionFromKey
import feature.desktop.isRemovableFromDesktop
import world.empery.mobile.core.network.api.DesktopWidgetTodoDto
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileFeatureShellPreferences

class DesktopHubTabViewModel(
    application: Application,
) : AuthenticatedTabViewModel(application) {
    private val appContext = application.applicationContext
    var handoffDraftText: String = MobileFeatureShellPreferences.getDesktopHandoffDraft(appContext).orEmpty()
        private set
    private val _uiState = MutableStateFlow(DesktopHubUiState())
    val uiState: StateFlow<DesktopHubUiState> = _uiState.asStateFlow()

    fun refresh() = viewModelScope.launch {
        if (!hasSession()) return@launch
        if (_uiState.value.isLoading) return@launch
        _uiState.update { it.copy(isLoading = true, error = null) }
        runCatching { container.desktopHubRepository.refreshSnapshot() }
            .onSuccess { snapshot ->
                val handoff = resolveDesktopHandoffDraft(
                    MobileFeatureShellPreferences.getDesktopHandoffDraft(appContext),
                    MobileFeatureShellPreferences.getDesktopHandoffExpiresMs(appContext),
                )
                _uiState.update { snapshot.copy(isLoading = false, error = null, handoffDraft = handoff) }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshDesktopHub failed")
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = err.message ?: getApplication<Application>().getString(R.string.app_desktop_hub_load_failed),
                    )
                }
            }
    }

    fun installApp(appId: String) = mutateDesktop { container.desktopHubRepository.installApp(appId) }

    fun uninstallApp(appId: String) {
        val app = _uiState.value.storeApps.find { it.app_id == appId }
        if (app != null && !app.isRemovableFromDesktop()) return
        mutateDesktop { container.desktopHubRepository.uninstallApp(appId) }
    }

    fun createNote(content: String) = mutateDesktop { container.desktopHubRepository.createWidgetNote(content) }

    fun deleteNote(noteId: String) = mutateDesktop { container.desktopHubRepository.deleteWidgetNote(noteId) }

    fun createTodo(text: String) = mutateDesktop { container.desktopHubRepository.createWidgetTodo(text) }

    fun toggleTodo(todo: DesktopWidgetTodoDto) = mutateDesktop { container.desktopHubRepository.toggleWidgetTodo(todo) }

    fun deleteTodo(todoId: String) = mutateDesktop { container.desktopHubRepository.deleteWidgetTodo(todoId) }

    fun createFavorite(title: String, url: String) =
        mutateDesktop { container.desktopHubRepository.createFavorite(title, url) }

    fun deleteFavorite(favoriteId: String) =
        mutateDesktop { container.desktopHubRepository.deleteFavorite(favoriteId) }

    fun cycleTheme() = mutateDesktop {
        container.desktopHubRepository.cycleTheme(_uiState.value.config?.theme)
    }

    fun toggleQuietMode() = mutateDesktop {
        container.desktopHubRepository.toggleQuietMode(_uiState.value.shellState?.quiet_mode)
    }

    private fun mutateDesktop(block: suspend () -> Unit) = viewModelScope.launch {
        if (!hasSession()) return@launch
        runCatching { block() }
            .onSuccess { refresh() }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "desktopHub mutation failed")
                _uiState.update { it.copy(error = err.message) }
            }
    }

    fun updateHandoffDraft(text: String) {
        handoffDraftText = text.take(4000)
    }

    fun saveHandoffDraft() {
        val expires = System.currentTimeMillis() + 24L * 60L * 60L * 1000L
        MobileFeatureShellPreferences.saveDesktopHandoffDraft(appContext, handoffDraftText, expires)
        refresh()
    }

    fun handleDeepLink(rawSection: String?) = viewModelScope.launch {
        if (!hasSession()) return@launch
        val section = resolveDesktopHubSectionFromKey(rawSection) ?: return@launch
        _uiState.update { it.copy(focusSectionId = section) }
    }

    fun consumeFocusSection() {
        _uiState.update { it.copy(focusSectionId = null) }
    }
}
