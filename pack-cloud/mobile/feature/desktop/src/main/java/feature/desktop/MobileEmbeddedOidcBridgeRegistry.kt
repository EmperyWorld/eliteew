// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Live OIDC token source + single-owner refresh for embedded SPA WebView JS bridge.
// Invariants:
// - App module installs provider from AuthRepository; feature/desktop stays auth-agnostic.
// - Only native refreshes empery-mobile refresh tokens; SPA must not call /api/auth/refresh.
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileApp.kt, keycloak.ts
// ---
package feature.desktop

data class MobileEmbeddedBootstrapTokens(
    val accessToken: String,
    val refreshToken: String,
)

fun interface MobileEmbeddedBootstrapTokenSource {
    fun readTokens(): MobileEmbeddedBootstrapTokens?
}

fun interface MobileEmbeddedTokenRefresher {
    /**
     * Blocks until native AuthRepository finishes refresh (or timeout).
     * Returns null on auth failure / missing session; throws on unexpected errors only if needed.
     */
    fun refreshBlocking(timeoutMs: Long): MobileEmbeddedBootstrapTokens?
}

/** Optional live token reader/refresher; falls back to Intent extras in WebView activity. */
object MobileEmbeddedOidcBridgeRegistry {
    @Volatile
    private var source: MobileEmbeddedBootstrapTokenSource? = null

    @Volatile
    private var refresher: MobileEmbeddedTokenRefresher? = null

    fun install(
        provider: MobileEmbeddedBootstrapTokenSource,
        tokenRefresher: MobileEmbeddedTokenRefresher? = null,
    ) {
        source = provider
        refresher = tokenRefresher
    }

    fun readTokens(): MobileEmbeddedBootstrapTokens? = source?.readTokens()

    fun refreshBlocking(timeoutMs: Long = DEFAULT_REFRESH_TIMEOUT_MS): MobileEmbeddedBootstrapTokens? =
        refresher?.refreshBlocking(timeoutMs)

    const val DEFAULT_REFRESH_TIMEOUT_MS: Long = 20_000L
}

typealias EwaCompanionBootstrapTokens = MobileEmbeddedBootstrapTokens
typealias EwaCompanionBootstrapTokenSource = MobileEmbeddedBootstrapTokenSource

/** @deprecated Use [MobileEmbeddedOidcBridgeRegistry] — kept for call-site stability. */
object EwaCompanionOidcBridgeRegistry {
    fun install(provider: EwaCompanionBootstrapTokenSource) {
        MobileEmbeddedOidcBridgeRegistry.install(provider)
    }

    fun readTokens(): EwaCompanionBootstrapTokens? = MobileEmbeddedOidcBridgeRegistry.readTokens()
}
