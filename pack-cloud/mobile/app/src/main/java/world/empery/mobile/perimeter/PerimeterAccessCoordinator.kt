/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrate perimeter probe, semi-silent renewal via Custom Tabs, post-renewal poll, and notifications.
 *
 * Invariants:
 * - Auto-renew only when user opted in; cooldown between attempts; no OAuth secrets stored.
 * - Perimeter probe failures degrade gracefully; never crash the app on transient transport errors.
 *
 * Related:
 * - MainViewModel, BackgroundSyncWorker, PerimeterAccessRepository
 */
package world.empery.mobile.perimeter

import android.content.Context
import android.util.Log
import feature.profile.PerimeterAccessRenewPolicy
import feature.profile.PerimeterAccessRepository
import world.empery.mobile.core.network.PerimeterProbeResult
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import world.empery.mobile.connectivity.ConnectivityObserver
import world.empery.mobile.core.network.MobileNetworkFailureSupport
import world.empery.mobile.core.network.PerimeterProbeOutcome
import world.empery.mobile.observability.MobileTelemetry
import java.io.IOException
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

class PerimeterAccessCoordinator(
    private val appContext: Context,
    private val repository: PerimeterAccessRepository,
    private val connectivityObserver: ConnectivityObserver = ConnectivityObserver(appContext),
) {
    private val scope =
        CoroutineScope(
            SupervisorJob() +
                Dispatchers.Main.immediate +
                CoroutineExceptionHandler { _, throwable ->
                    if (MobileNetworkFailureSupport.isTransientNetworkFailure(throwable)) {
                        Log.w(TAG, "[STEP] perimeter_coordinator_network_degrade", throwable)
                        MobileTelemetry.reportError(throwable, "perimeter_coordinator_network_degrade")
                    } else {
                        Log.e(TAG, "perimeter_coordinator_unhandled", throwable)
                        MobileTelemetry.reportError(throwable, "perimeter_coordinator_unhandled")
                    }
                },
        )
    private val workMutex = Mutex()
    private var pollJob: Job? = null
    private val renewalPending = AtomicBoolean(false)
    private val lastRenewalWasManual = AtomicBoolean(false)

    @Volatile
    private var activityContextRef: WeakReference<Context>? = null

    @Volatile
    var isAuthenticated: Boolean = false

    @Volatile
    var appInForeground: Boolean = false

    var onPerimeterRenewed: (() -> Unit)? = null

    fun bindActivityContext(context: Context) {
        activityContextRef = WeakReference(context)
    }

    fun clearActivityContext() {
        activityContextRef = null
    }

    fun onNetworkRestored() {
        scope.launch {
            probeIfNeeded()
            evaluateTriggers(source = "network_restored")
        }
    }

    suspend fun probeIfNeeded(): PerimeterProbeOutcome = probeNow()

    fun onRealtimeConnectionError(error: Throwable) {
        if (!isLikelyPerimeterTransportError(error)) return
        scope.launch { evaluateTriggers(source = "socket_error") }
    }

    fun onSyncFailed(error: Throwable) {
        if (!isLikelyPerimeterTransportError(error)) return
        scope.launch { evaluateTriggers(source = "sync_failed") }
    }

    fun onManualRenewRequested() {
        if (PerimeterTrustedDeviceSuppression.isSuppressed(appContext)) return
        scope.launch { startRenewal(manual = true) }
    }

    fun onActivityResumedAfterRenewalLaunch() {
        if (!renewalPending.get()) return
        scope.launch { pollUntilOpenOrTimeout() }
    }

    fun handleRenewIntent() {
        if (PerimeterTrustedDeviceSuppression.isSuppressed(appContext)) return
        scope.launch { startRenewal(manual = true) }
    }

    suspend fun probeNow(): PerimeterProbeOutcome {
        val networkValidated = connectivityObserver.isNetworkValidated()
        return safeProbe(networkValidated)?.outcome ?: PerimeterProbeOutcome.Error
    }

    private suspend fun safeProbe(networkValidated: Boolean): PerimeterProbeResult? =
        runCatching { repository.probe(networkValidated) }
            .onFailure { err ->
                val label =
                    if (MobileNetworkFailureSupport.isTransientNetworkFailure(err)) {
                        "perimeter_probe_transient_degrade"
                    } else {
                        "perimeter_probe_failed"
                    }
                MobileTelemetry.reportError(err, label)
            }
            .getOrNull()

    private suspend fun evaluateTriggers(source: String) {
        workMutex.withLock {
            if (!isAuthenticated) return
            if (PerimeterTrustedDeviceSuppression.isSuppressed(appContext)) {
                PerimeterAccessNotificationHelper.cancel(appContext)
                return
            }
            val networkValidated = connectivityObserver.isNetworkValidated()
            val result = safeProbe(networkValidated) ?: return
            if (result.outcome != PerimeterProbeOutcome.Closed) {
                PerimeterAccessNotificationHelper.cancel(appContext)
                return
            }
            maybeAutoRenew(source)
        }
    }

    private fun promptManualYandexAuthAfterFailedRenew() {
        repository.markAutoRenewFailed()
        if (PerimeterAccessRenewPolicy.shouldUseNotificationInsteadOfAutoLaunch(appInForeground)) {
            PerimeterAccessNotificationHelper.showRenewRequired(appContext)
        }
    }

    private suspend fun maybeAutoRenew(source: String) {
        if (PerimeterTrustedDeviceSuppression.isSuppressed(appContext)) return
        val networkValidated = connectivityObserver.isNetworkValidated()
        val canRenew =
            PerimeterAccessRenewPolicy.canAttemptAutoRenew(
                autoRenewEnabled = repository.readAutoRenewEnabled(),
                isAuthenticated = isAuthenticated,
                networkValidated = networkValidated,
                probeOutcome = PerimeterProbeOutcome.Closed,
                lastAttemptMs = repository.readLastRenewAttemptMs(),
            )
        if (!canRenew) return
        MobileTelemetry.trackBusinessEvent(
            "perimeter_auto_renew_trigger",
            mapOf("source" to source),
        )
        if (PerimeterAccessRenewPolicy.shouldUseNotificationInsteadOfAutoLaunch(appInForeground)) {
            PerimeterAccessNotificationHelper.showRenewRequired(appContext)
            return
        }
        startRenewal(manual = false)
    }

    private suspend fun startRenewal(manual: Boolean) {
        if (PerimeterTrustedDeviceSuppression.isSuppressed(appContext)) return
        workMutex.withLock {
            lastRenewalWasManual.set(manual)
            val launchContext = activityContextRef?.get() ?: appContext
            repository.markRenewAttempt()
            repository.setRenewing()
            renewalPending.set(true)
            PerimeterAccessNotificationHelper.cancel(appContext)
            runCatching {
                AccessGateCustomTabsLauncher.launch(launchContext, AccessGateCustomTabsLauncher.OAUTH_START_URL)
            }.onFailure { error ->
                renewalPending.set(false)
                repository.markAutoRenewFailed()
                safeProbe(connectivityObserver.isNetworkValidated())
                MobileTelemetry.reportError(error, "perimeter_renew_launch_failed manual=$manual")
            }
        }
    }

    private suspend fun pollUntilOpenOrTimeout() {
        pollJob?.cancel()
        pollJob =
            scope.launch {
                repeat(POLL_ATTEMPTS) {
                    delay(POLL_INTERVAL_MS)
                    val networkValidated = connectivityObserver.isNetworkValidated()
                    val result = safeProbe(networkValidated) ?: return@repeat
                    if (result.outcome == PerimeterProbeOutcome.Open) {
                        renewalPending.set(false)
                        PerimeterAccessNotificationHelper.cancel(appContext)
                        MobileTelemetry.trackBusinessEvent("perimeter_renew_success")
                        onPerimeterRenewed?.invoke()
                        return@launch
                    }
                }
                renewalPending.set(false)
                promptManualYandexAuthAfterFailedRenew()
                safeProbe(connectivityObserver.isNetworkValidated())
            }
    }

    private fun isLikelyPerimeterTransportError(error: Throwable): Boolean {
        if (error is HttpException) {
            return error.code() !in PERIMETER_NON_TRANSPORT_HTTP
        }
        return error is IOException
    }

    companion object {
        private const val TAG = "PerimeterAccess"
        private const val POLL_INTERVAL_MS = 2_000L
        private const val POLL_ATTEMPTS = 30
        private val PERIMETER_NON_TRANSPORT_HTTP = setOf(401, 403, 409)
    }
}
