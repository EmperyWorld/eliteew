/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Application-scoped controller for the MobileAndroid WireGuard private tunnel beta.
 *
 * Invariants:
 * - Starting the tunnel requires explicit Android VPN consent; no silent fallback to public mode.
 * - CONNECTED is published only after setState(UP) and a successful edge TCP probe (traffic-ready).
 * - Unexpected DOWN after CONNECTED reconnects with RETRYING; VPN_CONFLICT is only for prepare()/permission reject.
 * - start() is idempotent while CONNECTING / WAITING_EDGE / RETRYING / STOPPING (no parallel bring-up).
 * - reconcilePublishedStatusWithBackend() heals CONNECTED-without-UP (zombie VpnService / missing tun0).
 * - Raw WireGuard config is used only for GoBackend parsing and never emitted in UI state/logs.
 * - Endpoint/DNS/address Logcat detail is DEBUG-only; release/stage logs are redacted lifecycle lines.
 *
 * Related:
 * - MobilePrivateTunnelConfigStore, MobilePrivateTunnelUserCopy, ProfileTabViewModel, MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.SystemClock
import android.util.Log
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import world.empery.mobile.BuildConfig
import world.empery.mobile.observability.MobileTelemetry

enum class MobilePrivateTunnelStatus {
    NOT_CONFIGURED,
    DISCONNECTED,
    PERMISSION_REQUIRED,
    VPN_CONFLICT,
    CONNECTING,
    WAITING_EDGE,
    RETRYING,
    CONNECTED,
    STOPPING,
    ERROR,
}

data class MobilePrivateTunnelSnapshot(
    val status: MobilePrivateTunnelStatus = MobilePrivateTunnelStatus.NOT_CONFIGURED,
    val configImported: Boolean = false,
    val peerAddress: String? = null,
    val endpoint: String? = null,
    val dns: String? = null,
    val message: String? = null,
    val error: String? = null,
    /** True after explicit user [stop] until the next [start] — shell must not auto-heal. */
    val shellAutoHealSuppressed: Boolean = false,
)

class MobilePrivateTunnelManager(
    context: Context,
    private val configStore: MobilePrivateTunnelConfigStore = MobilePrivateTunnelConfigStore(context),
) {
    private val appContext = context.applicationContext
    private val backend: GoBackend by lazy { GoBackend(appContext) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val userRequestedStop = AtomicBoolean(false)
    private val trafficReady = AtomicBoolean(false)
    private val reconnectAttempts = AtomicInteger(0)
    private var reconnectJob: Job? = null

    private val tunnel =
        object : Tunnel {
            override fun getName(): String = TUNNEL_NAME

            override fun onStateChange(newState: Tunnel.State) {
                val previousStatus = _state.value.status
                when (newState) {
                    Tunnel.State.UP -> {
                        // Traffic-ready is confirmed by edge probe, not by tun0 alone.
                        if (previousStatus == MobilePrivateTunnelStatus.CONNECTED && trafficReady.get()) {
                            return
                        }
                        if (
                            previousStatus == MobilePrivateTunnelStatus.CONNECTING ||
                            previousStatus == MobilePrivateTunnelStatus.WAITING_EDGE ||
                            previousStatus == MobilePrivateTunnelStatus.RETRYING
                        ) {
                            return
                        }
                        publishStatus(
                            status = MobilePrivateTunnelStatus.WAITING_EDGE,
                            message = MobilePrivateTunnelUserCopy.statusDetail(
                                appContext,
                                MobilePrivateTunnelStatus.WAITING_EDGE,
                            ),
                        )
                    }
                    Tunnel.State.DOWN -> {
                        trafficReady.set(false)
                        if (userRequestedStop.get() || previousStatus == MobilePrivateTunnelStatus.STOPPING) {
                            reconnectJob?.cancel()
                            reconnectAttempts.set(0)
                            publishStatus(
                                status = MobilePrivateTunnelStatus.DISCONNECTED,
                                message = MobilePrivateTunnelUserCopy.statusDetail(
                                    appContext,
                                    MobilePrivateTunnelStatus.DISCONNECTED,
                                ),
                                shellAutoHealSuppressed = true,
                            )
                            return
                        }
                        if (
                            previousStatus == MobilePrivateTunnelStatus.CONNECTED ||
                            previousStatus == MobilePrivateTunnelStatus.WAITING_EDGE ||
                            previousStatus == MobilePrivateTunnelStatus.CONNECTING
                        ) {
                            publishStatus(
                                status = MobilePrivateTunnelStatus.RETRYING,
                                message = MobilePrivateTunnelUserCopy.statusDetail(
                                    appContext,
                                    MobilePrivateTunnelStatus.RETRYING,
                                ),
                            )
                            scheduleReconnect()
                            return
                        }
                        if (previousStatus != MobilePrivateTunnelStatus.RETRYING) {
                            publishStatus(
                                status = MobilePrivateTunnelStatus.DISCONNECTED,
                                message = MobilePrivateTunnelUserCopy.statusDetail(
                                    appContext,
                                    MobilePrivateTunnelStatus.DISCONNECTED,
                                ),
                            )
                        }
                    }
                    Tunnel.State.TOGGLE -> Unit
                }
            }
        }

    private val _state = MutableStateFlow(initialSnapshot())
    val state: StateFlow<MobilePrivateTunnelSnapshot> = _state.asStateFlow()

    fun vpnPermissionIntent(): Intent? = VpnService.prepare(appContext)

    fun onVpnPermissionRejected() {
        MobileTelemetry.trackBusinessEvent(
            "private_tunnel_permission_rejected",
            mapOf("reason" to "android_vpn_not_granted"),
        )
        publishStatus(
            status = MobilePrivateTunnelStatus.VPN_CONFLICT,
            message = MobilePrivateTunnelUserCopy.vpnConflict(appContext),
        )
    }

    fun importConfig(rawConfig: String) {
        runCatching { configStore.saveConfig(rawConfig) }
            .onSuccess { summary ->
                _state.value =
                    MobilePrivateTunnelSnapshot(
                        status = MobilePrivateTunnelStatus.DISCONNECTED,
                        configImported = true,
                        peerAddress = summary.peerAddress,
                        endpoint = summary.endpoint,
                        dns = summary.dns,
                        message = MobilePrivateTunnelUserCopy.configSaved(appContext),
                    )
            }.onFailure { err ->
                Log.w(TAG, "Private tunnel config import failed", err)
                _state.value =
                    MobilePrivateTunnelSnapshot(
                        status = MobilePrivateTunnelStatus.ERROR,
                        configImported = configStore.hasConfig(),
                        peerAddress = configStore.summary()?.peerAddress,
                        endpoint = configStore.summary()?.endpoint,
                        dns = configStore.summary()?.dns,
                        error = MobilePrivateTunnelUserCopy.sanitizeError(appContext, err),
                    )
            }
    }

    fun clearConfig() {
        runCatching { configStore.clear() }
            .onSuccess {
                _state.value =
                    MobilePrivateTunnelSnapshot(
                        message = MobilePrivateTunnelUserCopy.configRemoved(appContext),
                    )
            }.onFailure { err ->
                Log.w(TAG, "Private tunnel config clear failed", err)
                publishStatus(
                    status = MobilePrivateTunnelStatus.ERROR,
                    error = MobilePrivateTunnelUserCopy.sanitizeError(appContext, err),
                )
            }
    }

    suspend fun refresh() {
        val summary = configStore.summary()
        if (summary == null) {
            _state.value = MobilePrivateTunnelSnapshot()
            return
        }
        val current =
            runCatching { backend.getState(tunnel) }
                .getOrDefault(Tunnel.State.DOWN)
                ?: Tunnel.State.DOWN
        publishStatus(
            status =
                when (current) {
                    Tunnel.State.UP ->
                        if (trafficReady.get()) {
                            MobilePrivateTunnelStatus.CONNECTED
                        } else {
                            MobilePrivateTunnelStatus.WAITING_EDGE
                        }
                    Tunnel.State.DOWN -> MobilePrivateTunnelStatus.DISCONNECTED
                    Tunnel.State.TOGGLE -> _state.value.status
                },
            summary = summary,
        )
    }

    /**
     * Align published status with GoBackend state. Call before shell auto-heal so a
     * CONNECTED snapshot without an UP tunnel enters RETRYING instead of silent stall.
     */
    suspend fun reconcilePublishedStatusWithBackend() {
        if (userRequestedStop.get()) return
        if (!configStore.hasConfig()) return
        val backendState =
            runCatching { backend.getState(tunnel) }
                .getOrDefault(Tunnel.State.DOWN)
                ?: Tunnel.State.DOWN
        val status = _state.value.status
        if (status == MobilePrivateTunnelStatus.CONNECTED && backendState != Tunnel.State.UP) {
            Log.w(TAG, "Private tunnel reconcile: CONNECTED but backend=$backendState → RETRYING")
            trafficReady.set(false)
            publishStatus(
                status = MobilePrivateTunnelStatus.RETRYING,
                message =
                    MobilePrivateTunnelUserCopy.statusDetail(
                        appContext,
                        MobilePrivateTunnelStatus.RETRYING,
                    ),
            )
            scheduleReconnect()
            return
        }
        if (
            backendState == Tunnel.State.UP &&
            (
                status == MobilePrivateTunnelStatus.DISCONNECTED ||
                    status == MobilePrivateTunnelStatus.ERROR
            )
        ) {
            Log.i(TAG, "Private tunnel reconcile: backend UP while status=$status → WAITING_EDGE")
            trafficReady.set(false)
            publishStatus(
                status = MobilePrivateTunnelStatus.WAITING_EDGE,
                message =
                    MobilePrivateTunnelUserCopy.statusDetail(
                        appContext,
                        MobilePrivateTunnelStatus.WAITING_EDGE,
                    ),
            )
            val summary = configStore.summary()
            val edgeOk = awaitEdgeReachable(summary?.dns)
            if (userRequestedStop.get()) return
            if (_state.value.status == MobilePrivateTunnelStatus.RETRYING) return
            if (edgeOk) {
                trafficReady.set(true)
                reconnectAttempts.set(0)
                publishStatus(status = MobilePrivateTunnelStatus.CONNECTED, summary = summary)
            } else {
                trafficReady.set(false)
                publishStatus(
                    status = MobilePrivateTunnelStatus.RETRYING,
                    summary = summary,
                    message =
                        MobilePrivateTunnelUserCopy.statusDetail(
                            appContext,
                            MobilePrivateTunnelStatus.RETRYING,
                        ),
                )
                scheduleReconnect()
            }
        }
    }

    suspend fun start() {
        Log.i(TAG, "Private tunnel start requested")
        val startedAtMs = SystemClock.elapsedRealtime()
        val current = _state.value.status
        if (
            current == MobilePrivateTunnelStatus.CONNECTING ||
            current == MobilePrivateTunnelStatus.WAITING_EDGE ||
            current == MobilePrivateTunnelStatus.RETRYING ||
            current == MobilePrivateTunnelStatus.STOPPING
        ) {
            Log.i(TAG, "Private tunnel start ignored; already in progress status=$current")
            return
        }
        if (current == MobilePrivateTunnelStatus.CONNECTED && trafficReady.get()) {
            reconcilePublishedStatusWithBackend()
            if (_state.value.status == MobilePrivateTunnelStatus.CONNECTED && trafficReady.get()) {
                Log.i(TAG, "Private tunnel start ignored; already CONNECTED")
                return
            }
            if (
                _state.value.status == MobilePrivateTunnelStatus.RETRYING ||
                _state.value.status == MobilePrivateTunnelStatus.WAITING_EDGE
            ) {
                return
            }
        }

        userRequestedStop.set(false)
        reconnectJob?.cancel()
        reconnectAttempts.set(0)

        val permissionIntent = vpnPermissionIntent()
        if (permissionIntent != null) {
            Log.i(TAG, "Private tunnel start requires Android VPN permission")
            trackStartResult("permission_required", startedAtMs)
            publishStatus(
                status = MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
                message = MobilePrivateTunnelUserCopy.permissionRequired(appContext),
                shellAutoHealSuppressed = false,
            )
            return
        }

        val rawConfig =
            configStore.readConfig()
                ?: run {
                    publishStatus(
                        status = MobilePrivateTunnelStatus.NOT_CONFIGURED,
                        error = MobilePrivateTunnelUserCopy.importRequired(appContext),
                        shellAutoHealSuppressed = false,
                    )
                    return
                }
        val summary = configStore.summary()
        trafficReady.set(false)
        publishStatus(
            status = MobilePrivateTunnelStatus.CONNECTING,
            summary = summary,
            shellAutoHealSuppressed = false,
        )
        debugTunnelLog(
            "Private tunnel start parsed metadata address=${summary?.peerAddress} endpoint=${summary?.endpoint} dns=${summary?.dns}",
        )
        releaseTunnelLog("Private tunnel start: config loaded (metadata redacted)")

        val bringUpOk =
            withContext(Dispatchers.IO) {
                runCatching {
                    debugTunnelLog("Private tunnel config parse begin")
                    val parsed = Config.parse(rawConfig.byteInputStream())
                    debugTunnelLog("Private tunnel backend setState(UP) begin")
                    backend.setState(tunnel, Tunnel.State.UP, parsed)
                    true
                }.onFailure { err ->
                    Log.w(TAG, "Private tunnel start failed", err)
                    trackStartResult("failed", startedAtMs)
                    publishStatus(
                        status = MobilePrivateTunnelStatus.ERROR,
                        summary = summary,
                        error = MobilePrivateTunnelUserCopy.sanitizeError(appContext, err),
                    )
                }.getOrDefault(false)
            }
        if (!bringUpOk) {
            return
        }

        releaseTunnelLog("Private tunnel backend setState(UP) completed")
        publishStatus(status = MobilePrivateTunnelStatus.WAITING_EDGE, summary = summary)
        val edgeOk = awaitEdgeReachable(summary?.dns)
        if (userRequestedStop.get()) {
            return
        }
        // Unexpected DOWN may have handed control to reconnect already.
        if (_state.value.status == MobilePrivateTunnelStatus.RETRYING) {
            return
        }
        if (edgeOk) {
            trafficReady.set(true)
            reconnectAttempts.set(0)
            trackStartResult("connected", startedAtMs)
            publishStatus(status = MobilePrivateTunnelStatus.CONNECTED, summary = summary)
        } else {
            trafficReady.set(false)
            trackStartResult("edge_unreachable", startedAtMs)
            publishStatus(
                status = MobilePrivateTunnelStatus.ERROR,
                summary = summary,
                error = MobilePrivateTunnelUserCopy.edgeUnreachable(appContext),
            )
        }
    }

    suspend fun stop() {
        userRequestedStop.set(true)
        trafficReady.set(false)
        reconnectJob?.cancel()
        reconnectAttempts.set(0)
        val summary = configStore.summary()
        publishStatus(status = MobilePrivateTunnelStatus.STOPPING, summary = summary)
        withContext(Dispatchers.IO) {
            runCatching {
                Log.i(TAG, "Private tunnel backend setState(DOWN) begin")
                backend.setState(tunnel, Tunnel.State.DOWN, null)
            }.onSuccess {
                Log.i(TAG, "Private tunnel backend setState(DOWN) completed")
                publishStatus(
                    status = MobilePrivateTunnelStatus.DISCONNECTED,
                    summary = summary,
                    shellAutoHealSuppressed = true,
                )
            }.onFailure { err ->
                Log.w(TAG, "Private tunnel stop failed", err)
                publishStatus(
                    status = MobilePrivateTunnelStatus.ERROR,
                    summary = summary,
                    error = MobilePrivateTunnelUserCopy.sanitizeError(appContext, err),
                    shellAutoHealSuppressed = true,
                )
            }
        }
    }

    private fun scheduleReconnect() {
        if (userRequestedStop.get()) {
            return
        }
        val attempt = reconnectAttempts.incrementAndGet()
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
            Log.w(TAG, "Private tunnel reconnect exhausted after $attempt attempts")
            publishStatus(
                status = MobilePrivateTunnelStatus.ERROR,
                error = MobilePrivateTunnelUserCopy.edgeUnreachable(appContext),
            )
            return
        }
        reconnectJob?.cancel()
        reconnectJob =
            scope.launch {
                val baseDelayMs = (RECONNECT_BASE_DELAY_MS * (1L shl (attempt - 1).coerceAtMost(4)))
                    .coerceAtMost(RECONNECT_MAX_DELAY_MS)
                val jitterMs = Random.nextLong(0L, RECONNECT_JITTER_MS)
                delay(baseDelayMs + jitterMs)
                if (userRequestedStop.get()) {
                    return@launch
                }
                Log.i(TAG, "Private tunnel reconnect attempt=$attempt")
                runCatching { startFromReconnect() }
                    .onFailure { err ->
                        Log.w(TAG, "Private tunnel reconnect failed", err)
                        if (!userRequestedStop.get() && reconnectAttempts.get() < MAX_RECONNECT_ATTEMPTS) {
                            scheduleReconnect()
                        } else if (!userRequestedStop.get()) {
                            publishStatus(
                                status = MobilePrivateTunnelStatus.ERROR,
                                error = MobilePrivateTunnelUserCopy.sanitizeError(appContext, err),
                            )
                        }
                    }
            }
    }

    private suspend fun startFromReconnect() {
        if (userRequestedStop.get()) {
            return
        }
        val permissionIntent = vpnPermissionIntent()
        if (permissionIntent != null) {
            publishStatus(
                status = MobilePrivateTunnelStatus.VPN_CONFLICT,
                message = MobilePrivateTunnelUserCopy.vpnConflict(appContext),
            )
            return
        }
        val rawConfig =
            configStore.readConfig()
                ?: run {
                    publishStatus(
                        status = MobilePrivateTunnelStatus.NOT_CONFIGURED,
                        error = MobilePrivateTunnelUserCopy.importRequired(appContext),
                    )
                    return
                }
        val summary = configStore.summary()
        trafficReady.set(false)
        publishStatus(status = MobilePrivateTunnelStatus.RETRYING, summary = summary)
        val bringUpOk =
            withContext(Dispatchers.IO) {
                runCatching {
                    val parsed = Config.parse(rawConfig.byteInputStream())
                    backend.setState(tunnel, Tunnel.State.UP, parsed)
                    true
                }.getOrDefault(false)
            }
        if (!bringUpOk || userRequestedStop.get()) {
            if (!userRequestedStop.get()) {
                throw IllegalStateException("reconnect_bring_up_failed")
            }
            return
        }
        publishStatus(status = MobilePrivateTunnelStatus.WAITING_EDGE, summary = summary)
        val edgeOk = awaitEdgeReachable(summary?.dns)
        if (userRequestedStop.get()) {
            return
        }
        if (edgeOk) {
            trafficReady.set(true)
            reconnectAttempts.set(0)
            publishStatus(status = MobilePrivateTunnelStatus.CONNECTED, summary = summary)
        } else {
            throw IllegalStateException("edge_unreachable")
        }
    }

    private suspend fun awaitEdgeReachable(dnsFromSummary: String?): Boolean {
        val host = resolveEdgeProbeHost(dnsFromSummary)
        val deadlineMs = SystemClock.elapsedRealtime() + EDGE_PROBE_BUDGET_MS
        var delayMs = EDGE_PROBE_INITIAL_DELAY_MS
        while (SystemClock.elapsedRealtime() < deadlineMs) {
            if (userRequestedStop.get()) {
                return false
            }
            if (_state.value.status == MobilePrivateTunnelStatus.RETRYING) {
                return false
            }
            val ok =
                withContext(Dispatchers.IO) {
                    runCatching {
                        Socket().use { socket ->
                            socket.soTimeout = EDGE_PROBE_CONNECT_TIMEOUT_MS
                            socket.connect(
                                InetSocketAddress(host, EDGE_PROBE_PORT),
                                EDGE_PROBE_CONNECT_TIMEOUT_MS,
                            )
                        }
                        true
                    }.getOrDefault(false)
                }
            if (ok) {
                return true
            }
            delay(delayMs)
            delayMs = (delayMs * 2).coerceAtMost(EDGE_PROBE_MAX_DELAY_MS)
        }
        return false
    }

    private fun resolveEdgeProbeHost(dnsFromSummary: String?): String {
        val raw = dnsFromSummary?.trim().orEmpty()
        if (raw.isEmpty()) {
            return DEFAULT_EDGE_DNS
        }
        return raw.split(',', ' ', '\t', '\n')
            .map { it.trim() }
            .firstOrNull { it.isNotEmpty() }
            ?: DEFAULT_EDGE_DNS
    }

    private fun trackStartResult(
        result: String,
        startedAtMs: Long,
    ) {
        val durationMs = (SystemClock.elapsedRealtime() - startedAtMs).coerceAtLeast(0L)
        MobileTelemetry.trackBusinessEvent(
            "private_tunnel_start_result",
            mapOf(
                "result" to result,
                "duration_ms" to durationMs.toString(),
            ),
        )
    }

    private fun initialSnapshot(): MobilePrivateTunnelSnapshot {
        val summary = configStore.summary()
        return MobilePrivateTunnelSnapshot(
            status =
                if (summary == null) {
                    MobilePrivateTunnelStatus.NOT_CONFIGURED
                } else {
                    MobilePrivateTunnelStatus.DISCONNECTED
                },
            configImported = summary != null,
            peerAddress = summary?.peerAddress,
            endpoint = summary?.endpoint,
            dns = summary?.dns,
        )
    }

    private fun publishStatus(
        status: MobilePrivateTunnelStatus,
        summary: MobilePrivateTunnelConfigSummary? = configStore.summary(),
        message: String? = null,
        error: String? = null,
        shellAutoHealSuppressed: Boolean? = null,
    ) {
        _state.update {
            MobilePrivateTunnelSnapshot(
                status = status,
                configImported = summary != null,
                peerAddress = summary?.peerAddress,
                endpoint = summary?.endpoint,
                dns = summary?.dns,
                message = message ?: MobilePrivateTunnelUserCopy.statusDetail(appContext, status),
                error = error,
                shellAutoHealSuppressed = shellAutoHealSuppressed ?: it.shellAutoHealSuppressed,
            )
        }
    }

    /** Verbose tunnel diagnostics — debug builds only (may include endpoint/DNS). */
    private fun debugTunnelLog(message: String) {
        if (BuildConfig.DEBUG) {
            Log.i(TAG, message)
        }
    }

    /** Non-sensitive lifecycle log safe for release/stage Logcat. */
    private fun releaseTunnelLog(message: String) {
        if (!BuildConfig.DEBUG) {
            Log.i(TAG, message)
        }
    }

    companion object {
        private const val TAG = "MobilePrivateTunnelManager"
        private const val TUNNEL_NAME = "eliteew-mobile-private"
        private const val DEFAULT_EDGE_DNS = "10.88.88.1"
        private const val EDGE_PROBE_PORT = 443
        private const val EDGE_PROBE_CONNECT_TIMEOUT_MS = 2_000
        private const val EDGE_PROBE_BUDGET_MS = 45_000L
        private const val EDGE_PROBE_INITIAL_DELAY_MS = 500L
        private const val EDGE_PROBE_MAX_DELAY_MS = 5_000L
        private const val MAX_RECONNECT_ATTEMPTS = 5
        private const val RECONNECT_BASE_DELAY_MS = 1_000L
        private const val RECONNECT_MAX_DELAY_MS = 16_000L
        private const val RECONNECT_JITTER_MS = 500L
    }
}
