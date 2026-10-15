package world.empery.mobile.core.network

import okhttp3.CertificatePinner
import okhttp3.ConnectionSpec
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.TlsVersion
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509TrustManager

object NetworkFactory {

    /**
     * Production-oriented timeouts (seconds). All kept at 30s to match historical behavior;
     * split only for readability and tuning without changing API-facing semantics.
     */
    private const val CONNECT_TIMEOUT_SEC = 30L
    private const val READ_TIMEOUT_SEC = 30L
    private const val WRITE_TIMEOUT_SEC = 30L

    /**
     * Wall-clock cap for the entire call (connect, handshakes, redirects, body read/write).
     * Same value as the per-phase timeouts so behavior matches the previous single constant.
     */
    private const val CALL_TIMEOUT_SEC = 30L

    /**
     * TLS-only [ConnectionSpec]s for production traffic. Cleartext is intentionally omitted.
     * Prefer [MODERN_TLS] (1.2/1.3 + extensions), then [COMPATIBLE_TLS] for older stacks.
     * Override via [createRetrofit] only for targeted compatibility (e.g. lab proxies).
     */
    @JvmField
    val defaultProductionConnectionSpecs: List<ConnectionSpec> = listOf(
        ConnectionSpec.Builder(ConnectionSpec.MODERN_TLS)
            .tlsVersions(TlsVersion.TLS_1_2, TlsVersion.TLS_1_3)
            .supportsTlsExtensions(true)
            .build(),
        ConnectionSpec.COMPATIBLE_TLS,
    )

    /**
     * Resolves whether the embedding app is a debug build, without compile-time dependency on `:app`.
     * Falls back to false (no HTTP body logging) if the host app is absent or obfuscated away.
     */
    private fun isHostAppDebugBuild(): Boolean =
        try {
            Class.forName("world.empery.mobile.BuildConfig").getField("DEBUG").get(null) as Boolean
        } catch (_: Throwable) {
            false
        }

    @JvmStatic
    @JvmOverloads
    fun createRetrofit(
        baseUrl: String,
        tokenProvider: AccessTokenProvider,
        expiryProvider: TokenExpiryProvider = tokenProvider as? TokenExpiryProvider
            ?: object : TokenExpiryProvider {
                override fun expiresAtEpochSeconds(): Long? = null
            },
        tokenRefresher: TokenRefresher,
        dns: Dns = Dns.SYSTEM,
        connectionSpecs: List<ConnectionSpec> = defaultProductionConnectionSpecs,
        certificatePinner: CertificatePinner? = null,
        sslSocketFactory: SSLSocketFactory? = null,
        trustManager: X509TrustManager? = null,
        timeoutSeconds: Long = 30L,
        authInterceptorsEnabled: Boolean = true,
        configureClient: OkHttpClient.Builder.() -> Unit = {},
    ): Retrofit {
        val hostDebugBuild = isHostAppDebugBuild()

        val clientBuilder =
            OkHttpClient.Builder()
                // Timeouts: production defaults; all phases bounded to avoid hung sockets.
                .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .callTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .dns(dns)
                .connectionSpecs(connectionSpecs)

        certificatePinner?.let { clientBuilder.certificatePinner(it) }

        if (sslSocketFactory != null && trustManager != null) {
            clientBuilder.sslSocketFactory(sslSocketFactory, trustManager)
        }

        clientBuilder.configureClient()

        // Outer transport retry for idempotent GET (before auth stack).
        clientBuilder.addInterceptor(IdempotentGetRetryInterceptor())
        // Conditional GET ETag allowlist (skips if If-None-Match already set by Retrofit).
        clientBuilder.addInterceptor(ConditionalGetEtagInterceptor())

        if (authInterceptorsEnabled) {
            // Application interceptors run in add order (outer → inner toward the network).
            AuthAwareHttp.configureAuthApplicationInterceptors(
                clientBuilder,
                tokenProvider = tokenProvider,
                expiryProvider = expiryProvider,
                tokenRefresher = tokenRefresher,
            )
        }

        if (hostDebugBuild) {
            val logging =
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                }
            clientBuilder.addInterceptor(logging)
        }

        val client = clientBuilder.build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
