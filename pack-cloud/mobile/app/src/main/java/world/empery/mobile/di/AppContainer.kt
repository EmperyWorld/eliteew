/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Application dependency container for MobileAndroid repositories, auth, network clients, and app-scoped services.
 *
 * Invariants:
 * - Dependencies must store applicationContext only; Activity/Service contexts must not leak here.
 * - Network clients are initialized once and reused until process restart.
 * - Tunnel hard-cutover evicts/cancels session OkHttp clients only — never authBootstrapRetrofit.
 * - Auth bootstrap OkHttp has no private-tunnel NetworkGuard (SSO/refresh while VPN heals).
 * - Session/product OkHttp keeps fail-closed NetworkGuard in PRIVATE_TUNNEL_BETA.
 *
 * Related:
 * - AppRuntimeConfig, MobileApp, MobilePrivateTunnelManager, MobilePrivateTunnelHttpCutover
 */
package world.empery.mobile.di

import android.content.Context
import feature.chat.ChatLocalSettingsStore
import feature.chat.ChatRepository
import feature.desktop.DesktopHubRepository
import feature.feed.FeedRepository
import feature.friends.data.DefaultFriendsRepository
import feature.friends.domain.FriendsCacheInvalidator
import feature.friends.domain.usecase.FriendsUseCases
import feature.friends.presentation.FriendsErrorReporter
import feature.friends.presentation.FriendsSessionAccess
import feature.friends.presentation.FriendsTabViewModelFactory
import feature.friends.presentation.FriendsUiPreferences
import feature.notifications.NotificationCenterRepository
import feature.profile.ProfileRepository
import world.empery.mobile.AppRuntimeConfig
import world.empery.mobile.core.auth.AuthRepository
import world.empery.mobile.core.auth.MobileOidcRuntimeConfig
import world.empery.mobile.core.auth.MobileSsoAuthFactory
import world.empery.mobile.core.auth.OidcAuthManager
import world.empery.mobile.core.auth.SecureTokenStore
import world.empery.mobile.core.network.EmperyNetworkingDns
import world.empery.mobile.core.network.RetrofitFriendsRemoteDataSource
import world.empery.mobile.core.network.NetworkFactory
import world.empery.mobile.core.network.api.AuthApi
import world.empery.mobile.core.network.api.DesktopApi
import world.empery.mobile.core.network.api.EwDeskApi
import world.empery.mobile.core.network.api.FriendsApi
import world.empery.mobile.core.network.api.GafChatApi
import feature.profile.MobileAppUpdateRepository
import feature.profile.MobileProfileRepository
import feature.profile.PerimeterAccessRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import world.empery.mobile.core.media.MusicPlayerFavoritesRepository
import world.empery.mobile.core.network.PerimeterAccessProbe
import world.empery.mobile.core.network.api.MobileAppApi
import world.empery.mobile.core.network.api.MobileAppRealtimeStateBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceApi
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.VideoCallsApi
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.SessionCacheCleaner
import world.empery.mobile.core.storage.friendsDaoBundle
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileFeatureShellPreferences
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobilePrivateTunnelHttpCutover
import world.empery.mobile.tunnel.MobilePrivateTunnelManager
import world.empery.mobile.tunnel.MobilePrivateTunnelNetworkGuardInterceptor

private fun resolveApplicationContext(context: Context): Context {
    // Explicit null-check for Java/interop or test doubles that may return null.
    @Suppress("KotlinConstantConditions")
    val applicationContext = context.applicationContext
        ?: throw IllegalStateException(
            "AppContainer requires a Context with a non-null applicationContext " +
                "(use Application, Activity, or Service context).",
        )
    val packageName = applicationContext.packageName
    if (packageName.isBlank()) {
        throw IllegalStateException(
            "AppContainer requires a valid application Context (blank packageName).",
        )
    }
    return applicationContext
}

/**
 * Application-scoped dependency root. Callers may pass any [Context] that resolves a stable
 * application context (Activity, Service, or Application); all stored dependencies use
 * [applicationContext] for lifecycle safety.
 *
 * **Eager (constructor):** process config, secure storage, local DB, and chat settings — fail fast
 * during [Application.onCreate] if prerequisites are missing.
 *
 * **Lazy (first access, thread-safe):** Retrofit, API stubs, and feature repositories — built once
 * under [LazyThreadSafetyMode.SYNCHRONIZED] so concurrent first touches do not double-initialize.
 */
class AppContainer(context: Context) {
    private val appContext: Context = resolveApplicationContext(context)

    /** Eager: required for storage and config; failures surface at container construction time. */
    private val runtimeConfig = AppRuntimeConfig.from(appContext)

    private val tokenStore = SecureTokenStore(appContext)
    private val db = MobileDatabase.create(appContext)
    private val sessionCacheCleaner = SessionCacheCleaner(db)
    private val chatLocalSettingsStore = ChatLocalSettingsStore(appContext)
    val mobilePrivateTunnelManager = MobilePrivateTunnelManager(appContext)

    /**
     * Lazy: full HTTP graph and repositories. Single synchronized initializer avoids duplicate
     * Retrofit/clients if multiple threads touch different repositories at once.
     */
    private val wired by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        AppContainerWiring(
            appContext = appContext,
            runtimeConfig = runtimeConfig,
            tokenStore = tokenStore,
            db = db,
            chatLocalSettingsStore = chatLocalSettingsStore,
            privateTunnelManager = mobilePrivateTunnelManager,
        )
    }

    val apiBaseUrl: String get() = runtimeConfig.baseUrl

    val authRepository: AuthRepository get() = wired.authRepository
    val oidcAuthManager: OidcAuthManager get() = wired.oidcAuthManager
    val feedRepository: FeedRepository get() = wired.feedRepository
    val notificationRepository: NotificationCenterRepository get() = wired.notificationRepository
    val profileRepository: ProfileRepository get() = wired.profileRepository
    val chatRepository: ChatRepository get() = wired.chatRepository
    val friendsUseCases: FriendsUseCases get() = wired.friendsUseCases
    val friendsViewModelFactory: FriendsTabViewModelFactory get() = wired.friendsViewModelFactory
    val desktopHubRepository: DesktopHubRepository get() = wired.desktopHubRepository
    val musicPlayerFavoritesRepository: MusicPlayerFavoritesRepository get() = wired.musicPlayerFavoritesRepository
    val ugsHubRepository: feature.ugs.UgsHubRepository get() = wired.ugsHubRepository
    val okHttpClient: okhttp3.OkHttpClient get() = wired.okHttpClient
    val mobileAppUpdateRepository: MobileAppUpdateRepository get() = wired.mobileAppUpdateRepository
    val mobileProfileRepository: MobileProfileRepository get() = wired.mobileProfileRepository
    val mobileTrustedDeviceApi: MobileTrustedDeviceApi get() = wired.mobileTrustedDeviceApi

    val perimeterAccessRepository: PerimeterAccessRepository get() = wired.perimeterAccessRepository

    suspend fun clearSessionScopedCache() {
        sessionCacheCleaner.clearSessionScopedCache()
    }

    fun invalidateHttpConnectionsAfterUpgrade() {
        runCatching { wired.okHttpClient.connectionPool.evictAll() }
    }

    /**
     * Seamless Tunnel Recovery hard cutover: cancel in-flight session calls and evict pools.
     * Does not touch the auth bootstrap OkHttp client used for SSO/token refresh.
     */
    fun hardCutoverSessionHttpConnectionsForTunnel() {
        wired.hardCutoverSessionHttpConnectionsForTunnel()
    }

    fun invalidateConditionalGetCachesAfterUpgrade() {
        runCatching { wired.friendsCacheInvalidator.invalidateOverviewCache() }
        runCatching { wired.desktopHubRepository.invalidateConditionalGetCachesAfterUpgrade() }
    }

    suspend fun reportMobileRealtimeState(foreground: Boolean) {
        wired.reportMobileRealtimeState(foreground)
    }
}

/**
 * One-shot wiring of network clients and feature repositories. Instantiated only via
 * [AppContainer]'s synchronized lazy delegate.
 */
private class AppContainerWiring(
    appContext: Context,
    runtimeConfig: AppRuntimeConfig,
    tokenStore: SecureTokenStore,
    db: MobileDatabase,
    chatLocalSettingsStore: ChatLocalSettingsStore,
    privateTunnelManager: MobilePrivateTunnelManager,
) {
    private val okhttpDns =
        EmperyNetworkingDns.okhttpDns(
            runtimeConfig.baseUrl,
            runtimeConfig.ssoLoginUrl,
            forceSystemDns = runtimeConfig.connectionMode == MobileConnectionMode.PRIVATE_TUNNEL_BETA,
        )
    private val privateTunnelNetworkGuard =
        if (runtimeConfig.connectionMode == MobileConnectionMode.PRIVATE_TUNNEL_BETA) {
            MobilePrivateTunnelNetworkGuardInterceptor(appContext, privateTunnelManager)
        } else {
            null
        }
    private val privateTunnelClientConfiguration: okhttp3.OkHttpClient.Builder.() -> Unit = {
        privateTunnelNetworkGuard?.let { addInterceptor(it) }
    }

    // SSO / refresh must work while the private tunnel is still bringing up (login + OTA reconcile).
    // Product API clients keep the fail-closed NetworkGuard; auth bootstrap does not.
    private val authBootstrapRetrofit = NetworkFactory.createRetrofit(
        baseUrl = runtimeConfig.baseUrl,
        tokenProvider = tokenStore,
        tokenRefresher = object : world.empery.mobile.core.network.TokenRefresher {
            override suspend fun refreshAccessToken(): String? = null
        },
        dns = okhttpDns,
        timeoutSeconds = 20L,
        authInterceptorsEnabled = false,
    )

    private val authApi = authBootstrapRetrofit.create(AuthApi::class.java)
    val authRepository =
        AuthRepository(
            authApi = authApi,
            tokenStore = tokenStore,
            expectedOidcClientId = runtimeConfig.keycloakClientId,
        )
    val oidcAuthManager =
        MobileSsoAuthFactory.create(
            context = appContext,
            config =
                MobileOidcRuntimeConfig(
                    authorizationEndpoint = runtimeConfig.keycloakAuthorizationEndpoint,
                    tokenEndpoint = runtimeConfig.keycloakTokenEndpoint,
                    clientId = runtimeConfig.keycloakClientId,
                    redirectUri = runtimeConfig.keycloakRedirectUri,
                ),
        )

    private val retrofit = NetworkFactory.createRetrofit(
        baseUrl = runtimeConfig.baseUrl,
        tokenProvider = tokenStore,
        tokenRefresher = authRepository,
        dns = okhttpDns,
        configureClient = privateTunnelClientConfiguration,
    )

    val okHttpClient: okhttp3.OkHttpClient = retrofit.callFactory() as okhttp3.OkHttpClient

    private val longPollingRetrofit = NetworkFactory.createRetrofit(
        baseUrl = runtimeConfig.baseUrl,
        tokenProvider = tokenStore,
        tokenRefresher = authRepository,
        timeoutSeconds = 180L,
        dns = okhttpDns,
        configureClient = privateTunnelClientConfiguration,
    )
    private val longPollingOkHttpClient: okhttp3.OkHttpClient =
        longPollingRetrofit.callFactory() as okhttp3.OkHttpClient

    private val contentDownloadRetrofit = NetworkFactory.createRetrofit(
        baseUrl = runtimeConfig.baseUrl,
        tokenProvider = tokenStore,
        tokenRefresher = authRepository,
        timeoutSeconds = 180L,
        dns = okhttpDns,
        configureClient = privateTunnelClientConfiguration,
    )
    private val contentDownloadOkHttpClient: okhttp3.OkHttpClient =
        contentDownloadRetrofit.callFactory() as okhttp3.OkHttpClient

    /** GAF attachments, unified content, avatar — slow mobile uplinks need >30s write budget. */
    private val contentUploadRetrofit = NetworkFactory.createRetrofit(
        baseUrl = runtimeConfig.baseUrl,
        tokenProvider = tokenStore,
        tokenRefresher = authRepository,
        timeoutSeconds = 300L,
        dns = okhttpDns,
        configureClient = privateTunnelClientConfiguration,
    )
    private val contentUploadOkHttpClient: okhttp3.OkHttpClient =
        contentUploadRetrofit.callFactory() as okhttp3.OkHttpClient

    /**
     * Session/authenticated HTTP clients only. [authBootstrapRetrofit] is intentionally excluded
     * so tunnel hard-cutover never cancels SSO / refresh traffic.
     */
    private val sessionHttpClientsForTunnelCutover: List<okhttp3.OkHttpClient> =
        listOf(
            okHttpClient,
            longPollingOkHttpClient,
            contentDownloadOkHttpClient,
            contentUploadOkHttpClient,
        )

    fun hardCutoverSessionHttpConnectionsForTunnel() {
        MobilePrivateTunnelHttpCutover.applyToSessionClients(sessionHttpClientsForTunnelCutover)
    }

    private val profileApi = contentUploadRetrofit.create(ProfileApi::class.java)
    private val mobileAppApi = retrofit.create(MobileAppApi::class.java)
    val mobileTrustedDeviceApi: MobileTrustedDeviceApi = retrofit.create(MobileTrustedDeviceApi::class.java)
    private val ewDeskApi = retrofit.create(EwDeskApi::class.java)
    private val gafChatApi = retrofit.create(GafChatApi::class.java)
    private val videoCallsApi = retrofit.create(VideoCallsApi::class.java)
    private val unifiedContentApi = contentUploadRetrofit.create(UnifiedContentApi::class.java)
    private val unifiedContentDownloadApi = contentDownloadRetrofit.create(UnifiedContentApi::class.java)
    private val friendsApi = retrofit.create(FriendsApi::class.java)
    private val friendsRemoteDataSource = RetrofitFriendsRemoteDataSource(friendsApi)
    private val desktopApi = retrofit.create(DesktopApi::class.java)
    private val ugsApi = longPollingRetrofit.create(world.empery.mobile.core.network.api.UgsApi::class.java)
    private val ewrpApi = longPollingRetrofit.create(world.empery.mobile.core.network.api.EwrpApi::class.java)
    private val imageStudioApi = longPollingRetrofit.create(world.empery.mobile.core.network.api.ImageStudioApi::class.java)
    private val desktopAiChatApi = longPollingRetrofit.create(world.empery.mobile.core.network.api.DesktopAiChatApi::class.java)

    private val musicApi = longPollingRetrofit.create(world.empery.mobile.core.network.api.MusicApi::class.java)
    private val musicForgeApi =
        longPollingRetrofit.create(world.empery.mobile.core.network.api.MusicForgeApi::class.java)

    val feedRepository = FeedRepository(ewDeskApi, db)
    val notificationRepository = NotificationCenterRepository(profileApi, db)
    private val friendsRepository =
        DefaultFriendsRepository(
            remote = friendsRemoteDataSource,
            localBundle = friendsDaoBundle(db),
        )
    val friendsCacheInvalidator: FriendsCacheInvalidator = friendsRepository
    val friendsUseCases = FriendsUseCases.create(friendsRepository)
    val friendsViewModelFactory =
        FriendsTabViewModelFactory(
            useCases = friendsUseCases,
            sessionAccess = FriendsSessionAccess { authRepository.hasSession() },
            errorReporter =
                FriendsErrorReporter { error, context ->
                    MobileTelemetry.reportError(error, context)
                },
            uiPreferences =
                object : FriendsUiPreferences {
                    override fun isSocialHubInboxExpanded(): Boolean =
                        MobileFeatureShellPreferences.isFriendsInboxExpanded(appContext)

                    override fun setSocialHubInboxExpanded(expanded: Boolean) {
                        MobileFeatureShellPreferences.setFriendsInboxExpanded(appContext, expanded)
                    }
                },
        )
    val profileRepository =
        ProfileRepository(
            api = profileApi,
            db = db,
            appContext = appContext,
            friendCirclesProvider = friendsRepository,
        )
    val perimeterAccessRepository =
        PerimeterAccessRepository(
            appContext = appContext,
            probe =
                PerimeterAccessProbe(
                    healthUrl = PerimeterAccessProbe.healthUrlFromApiBase(runtimeConfig.baseUrl),
                ),
        )
    val mobileAppUpdateRepository =
        MobileAppUpdateRepository(
            api = mobileAppApi,
            okHttpClient = okHttpClient,
            apiRoot = runtimeConfig.baseUrl,
        )
    val mobileProfileRepository =
        MobileProfileRepository(
            appContext = appContext,
            mobileAppApi = mobileAppApi,
            contentUploadApi = unifiedContentApi,
            contentDownloadApi = unifiedContentDownloadApi,
            profileApi = profileApi,
        )
    val chatRepository = ChatRepository(
        api = gafChatApi,
        videoCallsApi = videoCallsApi,
        contentApi = unifiedContentApi,
        appContext = appContext,
        db = db,
        localSettingsStore = chatLocalSettingsStore,
    )
    val desktopHubRepository = DesktopHubRepository(desktopApi)
    val musicPlayerFavoritesRepository =
        MusicPlayerFavoritesRepository(
            desktopApi = desktopApi,
            contentApi = unifiedContentDownloadApi,
            apiBaseUrl = runtimeConfig.baseUrl,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
        )
    val ugsHubRepository =
        feature.ugs.UgsHubRepository(
            ugsApi,
            ewrpApi,
            imageStudioApi,
            musicApi,
            musicForgeApi,
            unifiedContentDownloadApi,
            desktopAiChatApi,
        )

    suspend fun reportMobileRealtimeState(foreground: Boolean) {
        mobileAppApi.putRealtimeState(MobileAppRealtimeStateBody(foreground = foreground))
    }
}
