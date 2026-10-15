// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Fullscreen embedded desktop SPA host (EWA companion, Handbook, future routes) inside MobileAndroid.
// Bootstraps empery-mobile OIDC tokens into SPA localStorage before loading the hash route.
// Invariants:
// - Loads only validated HTTPS origins on trusted `*.eliteew.ru` hosts.
// - User-agent marker per route enables embedded-client detection in SPA.
// Related:
// - MobileEmbeddedSpaWebViewLauncher.kt, setupMobileEmbeddedOidcProfile.ts
// ---
package feature.desktop

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import org.json.JSONObject

/** Fullscreen embedded SPA inside MobileAndroid (trusted-device / private tunnel path). */
class EmperyMobileEmbeddedSpaWebViewActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var errorOverlay: LinearLayout
    private lateinit var rootFrame: FrameLayout
    private lateinit var spec: MobileEmbeddedSpaSpec

    private var webOrigin: String = ""
    private var accessToken: String = ""
    private var refreshToken: String = ""
    private var spaHashQuery: String = ""
    private var bootstrapPhase: BootstrapPhase = BootstrapPhase.LOADING_ORIGIN
    private var pageLoadFailed = false

    private enum class BootstrapPhase {
        LOADING_ORIGIN,
        LOADING_SPA,
        READY,
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!readIntentExtras(intent)) {
            finish()
            return
        }

        webView = WebView(this)
        errorOverlay =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundColor(0xEE000000.toInt())
                visibility = View.GONE
                setPadding(48, 48, 48, 48)
                addView(
                    TextView(context).apply {
                        text = getString(spec.errorTitleRes)
                        setTextColor(Color.WHITE)
                        textSize = 18f
                        gravity = Gravity.CENTER
                    },
                )
                addView(
                    TextView(context).apply {
                        text = getString(spec.errorBodyRes)
                        setTextColor(0xCCFFFFFF.toInt())
                        textSize = 14f
                        gravity = Gravity.CENTER
                        setPadding(0, 24, 0, 24)
                    },
                )
                addView(
                    android.widget.Button(context).apply {
                        text = getString(R.string.desktop_embedded_webview_retry)
                        setOnClickListener {
                            pageLoadFailed = false
                            visibility = View.GONE
                            bootstrapPhase = BootstrapPhase.LOADING_ORIGIN
                            startSpaLoad(clearCache = true)
                        }
                    },
                )
                addView(
                    android.widget.Button(context).apply {
                        text = getString(R.string.desktop_embedded_webview_close)
                        setOnClickListener { finish() }
                    },
                )
            }

        rootFrame =
            FrameLayout(this).apply {
                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                addView(
                    webView,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT,
                    ),
                )
                addView(
                    errorOverlay,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT,
                    ),
                )
            }

        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.decorView.setBackgroundColor(0xFF0B0F17.toInt())

        enableWebViewDebuggingForDebugBuilds()
        configureWebView()
        webView.addJavascriptInterface(
            NativeOidcBootstrapBridge(accessToken, refreshToken),
            NATIVE_OIDC_BRIDGE_NAME,
        )
        webView.addJavascriptInterface(
            EmbeddedSpaChromeBridge { finish() },
            EMBEDDED_CHROME_BRIDGE_NAME,
        )
        configureBackNavigation()

        val toolbarTitle =
            if (spec.showNativeTitle) {
                getString(spec.titleRes)
            } else {
                null
            }
        setContent {
            MobileEmbeddedSpaTheme {
                MobileEmbeddedSpaHost(
                    closeLabel = getString(R.string.desktop_embedded_webview_close),
                    title = toolbarTitle,
                    onClose = { finish() },
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { rootFrame },
                    )
                }
            }
        }
        startSpaLoad(clearCache = false)
    }

    override fun onDestroy() {
        runCatching {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun readIntentExtras(source: Intent?): Boolean {
        val spaHash =
            source?.getStringExtra(MobileEmbeddedSpaWebViewLauncher.EXTRA_SPA_HASH)?.trim().orEmpty()
        val resolvedSpec = MobileEmbeddedSpaSpecs.resolve(spaHash) ?: return false
        spec = resolvedSpec
        val origin =
            source?.getStringExtra(MobileEmbeddedSpaWebViewLauncher.EXTRA_WEB_ORIGIN)?.trim().orEmpty()
        val access =
            source?.getStringExtra(MobileEmbeddedSpaWebViewLauncher.EXTRA_ACCESS_TOKEN)?.trim().orEmpty()
        val refresh =
            source?.getStringExtra(MobileEmbeddedSpaWebViewLauncher.EXTRA_REFRESH_TOKEN)?.trim().orEmpty()
        if (!MobileEmbeddedSpaWebViewLauncher.isValidWebOrigin(origin)) return false
        if (access.isBlank() || refresh.isBlank()) return false
        webOrigin = origin
        accessToken = access
        refreshToken = refresh
        spaHashQuery =
            source?.getStringExtra(MobileEmbeddedSpaWebViewLauncher.EXTRA_SPA_HASH_QUERY)?.trim().orEmpty()
        return true
    }

    private fun startSpaLoad(clearCache: Boolean = false) {
        pageLoadFailed = false
        bootstrapPhase = BootstrapPhase.LOADING_ORIGIN
        if (clearCache) {
            runCatching {
                webView.clearCache(true)
            }
        }
        webView.loadUrl("$webOrigin/")
    }

    private fun injectOidcBootstrap(onDone: () -> Unit) {
        val liveTokens = MobileEmbeddedOidcBridgeRegistry.readTokens()
        val token = liveTokens?.accessToken?.trim().orEmpty().ifBlank { accessToken }
        val refresh = liveTokens?.refreshToken?.trim().orEmpty().ifBlank { refreshToken }
        val payload =
            JSONObject()
                .put("token", token)
                .put("refreshToken", refresh)
                .put("persistence", "local")
                .put("savedAt", System.currentTimeMillis())
        val payloadJson = JSONObject.quote(payload.toString())
        val script =
            buildString {
                append("(function(){try{")
                append("var p=JSON.parse(")
                append(payloadJson)
                append(");")
                append("localStorage.setItem('eliteew.keycloak.mobileEmbedded.oidcTokens.v1',JSON.stringify(p));")
                append("localStorage.setItem('eliteew.mobileEmbeddedClient.v1','1');")
                append("}catch(e){console.error('mobile_embedded_oidc_bootstrap',e);}})();")
            }
        webView.evaluateJavascript(script) { _ -> runOnUiThread { onDone() } }
    }

    private fun isTargetSpaUrl(url: String): Boolean = url.contains(spec.spaHash)

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.setBackgroundColor(0xFF0B0F17.toInt())
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            javaScriptCanOpenWindowsAutomatically = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            setGeolocationEnabled(false)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
            val baseUa = userAgentString.orEmpty()
            val marker = "${spec.uaMarker}/1.0"
            userAgentString =
                if (baseUa.contains(spec.uaMarker)) {
                    baseUa
                } else {
                    "$baseUa $marker"
                }
        }

        webView.webChromeClient =
            object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                    if (message != null) {
                        Log.i(
                            spec.logTag,
                            "embedded js ${message.messageLevel()} ${message.message()} @${message.sourceId()}:${message.lineNumber()}",
                        )
                    }
                    return super.onConsoleMessage(message)
                }
            }

        webView.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    if (request.url.scheme == "file" || request.url.scheme == "content") {
                        Log.w(spec.logTag, "blocked navigation scheme=${request.url.scheme}")
                        return true
                    }
                    val host = request.url.host?.lowercase().orEmpty()
                    if (bootstrapPhase == BootstrapPhase.READY && host.startsWith("auth.")) {
                        Log.w(spec.logTag, "blocked embedded Keycloak redirect host=$host")
                        return true
                    }
                    return if (MobileEmbeddedSpaWebViewLauncher.isTrustedEmperyHost(request.url.host)) {
                        false
                    } else {
                        Log.w(spec.logTag, "blocked navigation host=$host")
                        true
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    if (!request.isForMainFrame) return
                    pageLoadFailed = true
                    runOnUiThread { errorOverlay.visibility = View.VISIBLE }
                    Log.w(spec.logTag, "embedded spa page error code=${error.errorCode}")
                }

                override fun onRenderProcessGone(
                    view: WebView,
                    detail: RenderProcessGoneDetail,
                ): Boolean {
                    Log.e(
                        spec.logTag,
                        "embedded webview renderer gone didCrash=${detail.didCrash()} " +
                            "priority=${detail.rendererPriorityAtExit()}",
                    )
                    pageLoadFailed = true
                    runOnUiThread { errorOverlay.visibility = View.VISIBLE }
                    return true
                }

                override fun onPageFinished(
                    view: WebView,
                    url: String,
                ) {
                    super.onPageFinished(view, url)
                    CookieManager.getInstance().flush()
                    if (pageLoadFailed) return
                    when (bootstrapPhase) {
                        BootstrapPhase.LOADING_ORIGIN -> {
                            if (!url.startsWith(webOrigin)) return
                            injectOidcBootstrap {
                                bootstrapPhase = BootstrapPhase.LOADING_SPA
                                webView.loadUrl(
                                    MobileEmbeddedSpaWebViewLauncher.spaUrl(
                                        webOrigin,
                                        spec.spaHash,
                                        spaHashQuery.takeIf { it.isNotEmpty() },
                                    ),
                                )
                            }
                        }
                        BootstrapPhase.LOADING_SPA -> {
                            if (isTargetSpaUrl(url)) {
                                injectOidcBootstrap {
                                    bootstrapPhase = BootstrapPhase.READY
                                    errorOverlay.visibility = View.GONE
                                    Log.i(spec.logTag, "embedded spa ready url=$url")
                                }
                            }
                        }
                        BootstrapPhase.READY -> {
                            if (isTargetSpaUrl(url)) {
                                injectOidcBootstrap { /* keep live tokens fresh */ }
                            }
                            errorOverlay.visibility = View.GONE
                            Log.i(spec.logTag, "embedded spa page finished url=$url")
                        }
                    }
                }
            }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        finish()
                    }
                }
            },
        )
    }

    private fun enableWebViewDebuggingForDebugBuilds() {
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    companion object {
        const val NATIVE_OIDC_BRIDGE_NAME: String = "EmperyMobileNativeOidc"
        const val EMBEDDED_CHROME_BRIDGE_NAME: String = "EmperyMobileEmbeddedChrome"
    }
}

/** Exposes native SSO tokens + sole-owner refresh to SPA (Huawei WebView-safe). */
internal class NativeOidcBootstrapBridge(
    private val fallbackAccessToken: String,
    private val fallbackRefreshToken: String,
) {
    @JavascriptInterface
    fun getBootstrapJson(): String {
        val liveTokens = MobileEmbeddedOidcBridgeRegistry.readTokens()
        val access = liveTokens?.accessToken?.trim().orEmpty().ifBlank { fallbackAccessToken }
        val refresh = liveTokens?.refreshToken?.trim().orEmpty().ifBlank { fallbackRefreshToken }
        return JSONObject()
            .put("token", access)
            .put("refreshToken", refresh)
            .put("persistence", "local")
            .put("savedAt", System.currentTimeMillis())
            .toString()
    }

    /**
     * Synchronous for @JavascriptInterface: refreshes via AuthRepository mutex (single owner)
     * so embedded SPA never races native OkHttp/Socket refresh on the same Keycloak RT.
     */
    @JavascriptInterface
    fun refreshSessionJson(): String {
        val refreshed =
            MobileEmbeddedOidcBridgeRegistry.refreshBlocking(
                MobileEmbeddedOidcBridgeRegistry.DEFAULT_REFRESH_TIMEOUT_MS,
            )
        if (refreshed == null) {
            return JSONObject()
                .put("ok", false)
                .put("error", "refresh_failed")
                .toString()
        }
        return JSONObject()
            .put("ok", true)
            .put("token", refreshed.accessToken)
            .put("refreshToken", refreshed.refreshToken)
            .put("persistence", "local")
            .put("savedAt", System.currentTimeMillis())
            .toString()
    }
}

/** Lets embedded SPA close the host activity (mirrors native toolbar). */
internal class EmbeddedSpaChromeBridge(
    private val onClose: () -> Unit,
) {
    @JavascriptInterface
    fun close() {
        onClose()
    }
}
