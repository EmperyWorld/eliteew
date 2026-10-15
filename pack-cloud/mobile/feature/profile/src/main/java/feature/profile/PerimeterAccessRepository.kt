/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Perimeter access status state, probe orchestration, and auto-renew preference for Profile UI.
 *
 * Invariants:
 * - UI state never exposes IP addresses or SG TTL values.
 *
 * Related:
 * - PerimeterAccessProbe, ProfileTabViewModel, PerimeterAccessCoordinator
 */
package feature.profile

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import world.empery.mobile.core.network.PerimeterAccessProbe
import world.empery.mobile.core.network.PerimeterProbeOutcome
import world.empery.mobile.core.network.PerimeterProbeResult

enum class PerimeterAccessStatus {
    Unknown,
    Checking,
    Open,
    Closed,
    Renewing,
}

data class PerimeterAccessUiState(
    val status: PerimeterAccessStatus = PerimeterAccessStatus.Unknown,
    val autoRenewEnabled: Boolean = false,
    val lastCheckedAtMs: Long? = null,
    /** Set when semi-silent auto-renew did not open perimeter; user must complete Yandex OAuth manually. */
    val autoRenewFailed: Boolean = false,
    /** True when /api/health probe failed (network up but endpoint unreachable). */
    val healthUnavailable: Boolean = false,
)

class PerimeterAccessRepository(
    private val appContext: Context,
    private val probe: PerimeterAccessProbe,
) {
    private val _state = MutableStateFlow(initialState())
    val state: StateFlow<PerimeterAccessUiState> = _state.asStateFlow()

    private fun initialState(): PerimeterAccessUiState =
        PerimeterAccessUiState(
            autoRenewEnabled = PerimeterAccessPrefs.readAutoRenewEnabled(appContext),
        )

    fun readAutoRenewEnabled(): Boolean = PerimeterAccessPrefs.readAutoRenewEnabled(appContext)

    fun setAutoRenewEnabled(enabled: Boolean) {
        PerimeterAccessPrefs.setAutoRenewEnabled(appContext, enabled)
        _state.update { it.copy(autoRenewEnabled = enabled) }
    }

    fun markRenewAttempt() {
        PerimeterAccessPrefs.markRenewAttempt(appContext)
    }

    fun readLastRenewAttemptMs(): Long = PerimeterAccessPrefs.readLastRenewAttemptMs(appContext)

    fun setRenewing() {
        _state.update { it.copy(status = PerimeterAccessStatus.Renewing) }
    }

    fun markAutoRenewFailed() {
        _state.update { it.copy(autoRenewFailed = true) }
    }

    fun clearAutoRenewFailed() {
        _state.update { it.copy(autoRenewFailed = false) }
    }


    suspend fun probe(networkValidated: Boolean): PerimeterProbeResult =
        withContext(Dispatchers.IO) {
            _state.update {
                it.copy(
                    status = if (networkValidated) PerimeterAccessStatus.Checking else PerimeterAccessStatus.Unknown,
                )
            }
            val result = probe.probeSync(networkValidated)
            applyProbeResult(result)
            result
        }

    fun applyProbeResult(result: PerimeterProbeResult) {
        val status =
            when (result.outcome) {
                PerimeterProbeOutcome.Open -> PerimeterAccessStatus.Open
                PerimeterProbeOutcome.Closed -> PerimeterAccessStatus.Closed
                PerimeterProbeOutcome.NoNetwork -> PerimeterAccessStatus.Unknown
                PerimeterProbeOutcome.Error -> PerimeterAccessStatus.Unknown
            }
        _state.update {
            it.copy(
                status = status,
                lastCheckedAtMs = System.currentTimeMillis(),
                autoRenewFailed = if (result.outcome == PerimeterProbeOutcome.Open) false else it.autoRenewFailed,
                healthUnavailable = result.outcome == PerimeterProbeOutcome.Error,
            )
        }
    }
}
