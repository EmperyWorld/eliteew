/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tab-scoped ViewModel for Notification Center refresh, filters, and push/deeplink focus.
 *
 * Invariants:
 * - Deeplink focus uses feature/notifications NotificationDeepLinkSupport helpers.
 * - No session → handleDeepLink and refresh are no-ops.
 *
 * Related:
 * - NotificationDeepLinkSupport.kt, NotificationFeature.kt, MainActivity shell navigation
 */
package world.empery.mobile.tabs

import android.app.Application
import androidx.lifecycle.viewModelScope
import feature.notifications.NotificationCenterUiState
import feature.notifications.NotificationCta
import feature.notifications.NotificationFilter
import feature.notifications.resolveNotificationDeepLinkFocus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.core.storage.NotificationEntity
import world.empery.mobile.observability.MobileTelemetry

internal fun mergeNotificationDeepLinkFocus(
    state: NotificationCenterUiState,
    items: List<NotificationEntity>,
    rawNotificationId: String?,
): NotificationCenterUiState {
    val focus = resolveNotificationDeepLinkFocus(rawNotificationId, items, state.filter)
    return state.copy(
        items = items,
        detailItem = focus.detailItem ?: state.detailItem,
        focusedNotificationId = focus.focusedNotificationId,
    )
}

class NotificationsTabViewModel(
    application: Application,
) : AuthenticatedTabViewModel(application) {
    private val _uiState = MutableStateFlow(NotificationCenterUiState())
    val uiState: StateFlow<NotificationCenterUiState> = _uiState.asStateFlow()

    private var undoMarkAllReadMap: Map<String, String?> = emptyMap()

    fun handleDeepLink(rawNotificationId: String?) = viewModelScope.launch {
        if (!hasSession()) return@launch
        _uiState.update { it.copy(isLoading = true, error = null) }
        runCatching { container.notificationRepository.refresh() }
            .onSuccess { items ->
                _uiState.update { state ->
                    mergeNotificationDeepLinkFocus(state, items, rawNotificationId)
                        .copy(isLoading = false, error = null)
                }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "notificationsDeepLink.refresh failed")
                val cached = container.notificationRepository.loadFromCache()
                _uiState.update { state ->
                    mergeNotificationDeepLinkFocus(state, cached, rawNotificationId)
                        .copy(isLoading = false, error = err.message)
                }
            }
    }

    fun refresh() = viewModelScope.launch {
        if (!hasSession()) return@launch
        if (_uiState.value.isLoading) return@launch
        _uiState.update { it.copy(isLoading = true, error = null) }
        runCatching { container.notificationRepository.refresh() }
            .onSuccess { items ->
                _uiState.update { state -> state.copy(items = items, isLoading = false, error = null) }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshNotifications failed")
                val cached = container.notificationRepository.loadFromCache()
                _uiState.update {
                    it.copy(items = cached, isLoading = false, error = err.message)
                }
            }
    }

    fun setFilter(filter: NotificationFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    fun openDetail(item: NotificationEntity) {
        _uiState.update { it.copy(detailItem = item, focusedNotificationId = item.id) }
    }

    fun dismissDetail() {
        _uiState.update { it.copy(detailItem = null) }
    }

    fun clearFocus() {
        _uiState.update { it.copy(focusedNotificationId = null) }
    }

    fun markAllRead() = viewModelScope.launch {
        if (!hasSession()) return@launch
        runCatching { container.notificationRepository.markAllRead() }
            .onSuccess { (items, undo) ->
                undoMarkAllReadMap = undo
                _uiState.update {
                    it.copy(items = items, showUndoMarkAllRead = undo.isNotEmpty(), detailItem = null)
                }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "markAllRead failed")
            }
    }

    fun undoMarkAllRead() = viewModelScope.launch {
        if (!hasSession() || undoMarkAllReadMap.isEmpty()) return@launch
        val undo = undoMarkAllReadMap
        undoMarkAllReadMap = emptyMap()
        runCatching { container.notificationRepository.undoMarkAllRead(undo) }
            .onSuccess { items ->
                _uiState.update { it.copy(items = items, showUndoMarkAllRead = false) }
            }
            .onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "undoMarkAllRead failed")
            }
    }

    fun onDetailCta(cta: NotificationCta) = viewModelScope.launch {
        val detail = _uiState.value.detailItem ?: return@launch
        when (cta) {
            NotificationCta.MarkRead -> {
                runCatching { container.notificationRepository.markRead(listOf(detail.id)) }
                    .onSuccess { items ->
                        _uiState.update { it.copy(items = items, detailItem = items.firstOrNull { row -> row.id == detail.id }) }
                    }
            }
            else -> Unit
        }
    }

    fun consumeUndoSnackbar() {
        _uiState.update { it.copy(showUndoMarkAllRead = false) }
    }
}
