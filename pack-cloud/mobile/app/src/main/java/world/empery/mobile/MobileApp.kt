/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Application entry: DI container, FCM token sync, background work scheduling.
 *
 * Invariants:
 * - onCreate stays fast; heavy work deferred to main looper post.
 * - Transient VPN/SOCKS transport failures are logged, not fatal.
 * - Private tunnel beta starts Seamless Tunnel Recovery (hard cutover + CONNECTED sync flush).
 *
 * Related:
 * - AppContainer, SecureDeviceIdStore, MainViewModel, MobilePrivateTunnelRecoveryCoordinator
 */
package world.empery.mobile

import android.app.ActivityManager
import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.StrictMode
import android.util.Log
import androidx.work.Configuration
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.WorkManager
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import world.empery.mobile.core.auth.SecureDeviceIdStore
import world.empery.mobile.di.AppContainer
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.MusicPlayerFavoritesHolder
import world.empery.mobile.core.network.AccessTokenRefreshResult
import world.empery.mobile.core.network.MobileNetworkFailureSupport
import world.empery.mobile.sync.BackgroundSyncWorker
import feature.notifications.MobileNotificationPreferences
import world.empery.mobile.debug.MobileStrictModeDebugHelper
import coil.memory.MemoryCache
import feature.profile.MobileProfileSync
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.perimeter.PerimeterAccessCoordinator
import world.empery.mobile.shell.MobileFeatureShellPreferences
import world.empery.mobile.tunnel.MobilePrivateTunnelRecoveryCoordinator
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import feature.desktop.MobileEmbeddedBootstrapTokens
import feature.desktop.MobileEmbeddedOidcBridgeRegistry

/**
 * Application entry: keep [onCreate] fast; heavy work after first frame via [mainHandler].
 *
 * **Startup order (production):**
 * 1. [Application.onCreate] super
 * 2. StrictMode — debug only, log penalties (no death)
 * 3. Uncaught-exception handler — before optional Firebase / DI so init failures are chained
 * 4. [FirebaseApp] best-effort (no `google-services.json` hard fail)
 * 5. [AppContainer]
 * 6. Primary process: enqueue periodic work on the main looper (after `onCreate` returns)
 *
 * **Runtime:** [onTrimMemory] / [onLowMemory] emit light telemetry on strong memory pressure only.
 */
class MobileApp : Application(), Configuration.Provider, coil.ImageLoaderFactory {
    lateinit var container: AppContainer
        private set

    private val secureDeviceIdStore: SecureDeviceIdStore by lazy { SecureDeviceIdStore(this) }

    fun stableDeviceId(): String = secureDeviceIdStore.getOrCreate()

    val perimeterAccessCoordinator: PerimeterAccessCoordinator by lazy {
        PerimeterAccessCoordinator(this, container.perimeterAccessRepository)
    }

    val mobileProfileSync: MobileProfileSync by lazy {
        MobileProfileSync(
            appContext = applicationContext,
            repository = container.mobileProfileRepository,
            scope = applicationScope,
        )
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Post-OTA reconcile and other non-blocking bootstrap work. */
    internal fun launchBackgroundWork(block: suspend () -> Unit) {
        applicationScope.launch(Dispatchers.IO) {
            block()
        }
    }

    @Volatile
    private var realtimeTokenRefreshListener: (() -> Unit)? = null

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            MobileStrictModeDebugHelper.installIfDebug(
                isDebug = true,
                shellStrictModeEnabled = MobileFeatureShellPreferences.isStrictModeDebugEnabled(this),
            )
        }
        installGlobalUncaughtExceptionHandler()

        // Allow app startup without hard dependency on google-services.json.
        runCatching { FirebaseApp.initializeApp(this) }

        container = AppContainer(this)
        MobileEmbeddedOidcBridgeRegistry.install(
            provider = {
                container.authRepository.readSpaOidcBootstrapTokens()?.let { tokens ->
                    MobileEmbeddedBootstrapTokens(
                        accessToken = tokens.accessToken,
                        refreshToken = tokens.refreshToken,
                    )
                }
            },
            tokenRefresher = { timeoutMs ->
                runBlocking {
                    withTimeoutOrNull(timeoutMs) {
                        when (container.authRepository.refreshAccessTokenDetailed()) {
                            is AccessTokenRefreshResult.Success ->
                                container.authRepository.readSpaOidcBootstrapTokens()?.let { tokens ->
                                    MobileEmbeddedBootstrapTokens(
                                        accessToken = tokens.accessToken,
                                        refreshToken = tokens.refreshToken,
                                    )
                                }
                            else -> null
                        }
                    }
                }
            },
        )
        val runtimeConfig = AppRuntimeConfig.from(this)
        EmperyMediaPlayerHolder.install(
            context = this,
            okHttpClient = container.okHttpClient,
            apiBaseUrl = runtimeConfig.baseUrl,
        )
        MusicPlayerFavoritesHolder.install(container.musicPlayerFavoritesRepository)
        EmperyMediaPlayerHolder.playbackServiceStarter = { ctx ->
            world.empery.mobile.media.EmperyMediaPlaybackService.ensureRunning(ctx)
        }
        EmperyMediaPlayerHolder.playbackServiceStopper = { ctx ->
            world.empery.mobile.media.EmperyMediaPlaybackService.stop(ctx)
        }
        world.empery.mobile.push.EmperyNotificationSoundChannels.migrateIfNeeded(this)
        world.empery.mobile.upgrade.MobileAppUpgradeCoordinator.runOnColdStart(this)
        container.authRepository.onAccessTokenRefreshed = {
            realtimeTokenRefreshListener?.invoke()
        }

        MobilePrivateTunnelRecoveryCoordinator(this, applicationScope).start()

        // Defer WorkManager enqueue so Application#onCreate returns quickly (non-blocking startup).
        mainHandler.post {
            if (isPrimaryAppProcess()) {
                scheduleBackgroundSync()
            }
        }
    }

    @Volatile
    var mobileRealtimeStateReporter: ((Boolean) -> Unit)? = null

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            mobileRealtimeStateReporter?.invoke(false)
        }
        when (level) {
            ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN ->
                MobileMemoryTrim.trimImageCaches(this, aggressive = false)
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL,
            ComponentCallbacks2.TRIM_MEMORY_MODERATE,
            ComponentCallbacks2.TRIM_MEMORY_COMPLETE,
            -> MobileMemoryTrim.trimImageCaches(this, aggressive = true)
        }
        when (level) {
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL,
            ComponentCallbacks2.TRIM_MEMORY_MODERATE,
            ComponentCallbacks2.TRIM_MEMORY_COMPLETE,
            -> {
                runCatching {
                    MobileTelemetry.trackBusinessEvent(
                        "app_trim_memory",
                        mapOf("level" to level.toString()),
                    )
                }
            }
        }
    }

    override fun onLowMemory() {
        super.onLowMemory()
        runCatching {
            MobileTelemetry.trackBusinessEvent("app_on_low_memory", emptyMap())
        }
    }

    override fun newImageLoader(): coil.ImageLoader {
        return coil.ImageLoader.Builder(this)
            .okHttpClient { container.okHttpClient }
            .crossfade(true)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.15)
                    .build()
            }
            .build()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()

    /**
     * WorkManager default initializer is removed in the manifest; this [Configuration.Provider]
     * supplies config on first [WorkManager.getInstance] (after app super.onCreate).
     */

    fun setRealtimeTokenRefreshListener(listener: (() -> Unit)?) {
        realtimeTokenRefreshListener = listener
    }

    /**
     * Optional Socket.IO pause/resume aligned with private-tunnel HTTP hard cutover / orchestrated resume.
     * Wired by [MainViewModel]; never touches auth-bootstrap OkHttp.
     */
    @Volatile
    var privateTunnelSocketHandover: PrivateTunnelSocketHandover? = null

    interface PrivateTunnelSocketHandover {
        fun onHardCutover()
        fun onOrchestratedResume()
    }

    fun scheduleBackgroundSync() {
        if (MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(this, container.mobilePrivateTunnelManager)) {
            Log.i(TAG, "background sync deferred until private tunnel is connected")
            return
        }
        runCatching {
            val request = BackgroundSyncWorker.buildDefaultPeriodicWorkRequest()
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                BackgroundSyncWorker.UNIQUE_PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }.onFailure { e ->
            Log.e(TAG, "scheduleBackgroundSync failed process=${currentProcessName()}", e)
            MobileTelemetry.reportError(e, "scheduleBackgroundSync process=${currentProcessName()}")
        }
    }

    /**
     * Resolves the current FCM registration token and registers it with the API when a session exists.
     * Safe to call after login or notification permission changes.
     */
    fun scheduleFcmTokenSyncWithBackend() {
        if (MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(this, container.mobilePrivateTunnelManager)) {
            Log.i(TAG, "FCM token sync deferred until private tunnel is connected")
            return
        }
        runCatching {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    val ex = task.exception
                    if (ex != null) {
                        MobileTelemetry.reportError(ex, "FCM getToken failed")
                    }
                    return@addOnCompleteListener
                }
                val token = task.result ?: return@addOnCompleteListener
                MobileNotificationPreferences.cacheFcmToken(this, token)
                syncFcmTokenToBackend(token)
            }
        }.onFailure { e ->
            MobileTelemetry.reportError(e, "scheduleFcmTokenSyncWithBackend failed")
        }
    }

    /** Called from [MobileFirebaseMessagingService.onNewToken] with the fresh token (no extra FCM round-trip). */
    fun onFcmTokenRefreshed(token: String) {
        MobileNotificationPreferences.cacheFcmToken(this, token)
        if (MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(this, container.mobilePrivateTunnelManager)) {
            Log.i(TAG, "fresh FCM token backend sync deferred until private tunnel is connected")
            return
        }
        syncFcmTokenToBackend(token)
    }

    private fun syncFcmTokenToBackend(token: String) {
        applicationScope.launch {
            if (!container.authRepository.hasSession()) return@launch
            runCatching {
                container.profileRepository.registerMobilePushToken(token, (applicationContext as MobileApp).stableDeviceId())
                MobileTelemetry.trackBusinessEvent("push_token_registered_backend")
            }.onFailure { e ->
                MobileTelemetry.reportError(e, "registerMobilePushToken failed")
            }
        }
    }

    /** Best-effort: stop server-side push delivery for this device after logout. */
    suspend fun unregisterMobilePushTokenFromBackend() {
        if (!container.authRepository.hasSession()) return
        val token = feature.notifications.MobileNotificationPreferences.readCachedFcmToken(this) ?: return
        runCatching {
            container.profileRepository.unregisterMobilePushToken(token, stableDeviceId())
            MobileTelemetry.trackBusinessEvent("push_token_unregistered_backend")
        }.onFailure { e ->
            MobileTelemetry.reportError(e, "unregisterMobilePushToken failed")
        }
    }


    /**
     * Production crash path: record to telemetry, then delegate to the previous handler
     * (system default finishes the process). Telemetry is wrapped so reporting never masks the crash.
     */
    private fun installGlobalUncaughtExceptionHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            if (MobileNetworkFailureSupport.isTransientNetworkFailure(throwable)) {
                Log.w(
                    TAG,
                    "[STEP] suppressed_transient_network_uncaught thread=${thread.name}",
                    throwable,
                )
                runCatching {
                    MobileTelemetry.reportError(
                        throwable,
                        "transient_network_uncaught thread=${thread.name}",
                    )
                }.onFailure { err ->
                    Log.e(TAG, "telemetry failed during transient_network_uncaught", err)
                }
                return@setDefaultUncaughtExceptionHandler
            }
            val proc = currentProcessName()
            persistLocalCrashSnapshot(proc, thread, throwable)
            try {
                MobileTelemetry.reportError(
                    throwable,
                    "uncaught_exception process=$proc thread=${thread.name}",
                )
            } catch (t: Throwable) {
                Log.e(TAG, "telemetry failed during uncaught_exception", t)
            }
            try {
                previous?.uncaughtException(thread, throwable)
            } catch (t: Throwable) {
                Log.e(TAG, "previous uncaught handler failed", t)
                throw throwable
            }
        }
    }

    private fun persistLocalCrashSnapshot(
        processName: String,
        thread: Thread,
        throwable: Throwable,
    ) {
        val stack = Log.getStackTraceString(throwable)
        Log.e(TAG, "uncaught_exception process=$processName thread=${thread.name}", throwable)
        runCatching {
            getSharedPreferences(CRASH_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_CRASH_TS, System.currentTimeMillis())
                .putString(KEY_CRASH_PROCESS, processName)
                .putString(KEY_CRASH_THREAD, thread.name)
                .putString(KEY_CRASH_TYPE, throwable.javaClass.name)
                .putString(KEY_CRASH_MESSAGE, throwable.message.orEmpty())
                .putString(KEY_CRASH_STACK, stack.take(MAX_CRASH_STACK_CHARS))
                .commit()
        }.onFailure { err ->
            Log.e(TAG, "local crash snapshot write failed", err)
        }
    }

    /** Primary process matches the default package; secondary processes are named `package:xxx`. */
    private fun isPrimaryAppProcess(): Boolean = currentProcessName() == packageName

    private fun currentProcessName(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return getProcessName()
        }
        val pid = Process.myPid()
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return am.runningAppProcesses
            ?.firstOrNull { it.pid == pid }
            ?.processName
            ?: packageName
    }

    private companion object {
        private const val TAG = "MobileApp"
        private const val CRASH_PREFS_NAME = "mobile_last_crash"
        private const val KEY_CRASH_TS = "timestamp"
        private const val KEY_CRASH_PROCESS = "process"
        private const val KEY_CRASH_THREAD = "thread"
        private const val KEY_CRASH_TYPE = "type"
        private const val KEY_CRASH_MESSAGE = "message"
        private const val KEY_CRASH_STACK = "stack"
        private const val MAX_CRASH_STACK_CHARS = 24_000
    }
}
