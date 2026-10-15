package world.empery.mobile.tabs

import android.app.Application
import androidx.lifecycle.viewModelScope
import feature.ugs.UgsHubUiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry

class UgsHubTabViewModel(
    application: Application,
) : AuthenticatedTabViewModel(application) {
    private val _uiState = MutableStateFlow(UgsHubUiState())
    val uiState: StateFlow<UgsHubUiState> = _uiState.asStateFlow()

    fun refresh() = viewModelScope.launch {
        if (!hasSession()) return@launch
        if (_uiState.value.isLoading) return@launch
        _uiState.update { it.copy(isLoading = true, error = null) }
        runCatching { container.ugsHubRepository.refreshSnapshot() }
            .onSuccess { snapshot ->
                _uiState.update { snapshot.copy(isLoading = false, error = null) }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshUgsHub failed")
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = err.message ?: getApplication<Application>().getString(R.string.app_ugs_load_failed),
                    )
                }
            }
    }
}
