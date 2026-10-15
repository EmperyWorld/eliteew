/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-app Keycloak OIDC login WebView for Meta Quest and devices without Custom Tabs provider.
 *
 * Invariants:
 * - Loads only trusted Empery HTTPS hosts; intercepts configured OAuth redirect URI only.
 * - Manifest launchMode must remain standard (not singleTask) so Activity Result delivers
 *   RESULT_OK with the redirect Uri to [MobileRootScaffoldHost] SSO launcher.
 * - createIntent must not set FLAG_ACTIVITY_NEW_TASK / CLEAR_TOP (breaks result delivery).
 * - Never log authorization codes or tokens.
 *
 * Related:
 * - MobileSsoAuthLauncher, OidcAuthManager, MainViewModel, core/auth AndroidManifest
 */
package world.empery.mobile.core.auth

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import java.util.Locale

class EmperySsoWebViewActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var redirectUri: Uri

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        val authorizationUrl = intent.getStringExtra(EXTRA_AUTHORIZATION_URL)?.trim().orEmpty()
        val redirectRaw = intent.getStringExtra(EXTRA_REDIRECT_URI)?.trim().orEmpty()
        if (authorizationUrl.isEmpty() || redirectRaw.isEmpty() || !isTrustedAuthorizationUrl(authorizationUrl)) {
            Log.w(TAG, "SSO WebView: invalid launch extras")
            setResult(RESULT_CANCELED)
            finish()
            return
        }
        redirectUri = Uri.parse(MobileOAuthRedirectUris.canonicalize(redirectRaw))

        webView = WebView(this)
        configureWebView(webView)

        val header =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(24, 24, 24, 12)
                addView(
                    TextView(context).apply {
                        text = getString(R.string.auth_sso_webview_title)
                        textSize = 18f
                    },
                    LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                )
                addView(
                    Button(context).apply {
                        text = getString(R.string.auth_sso_webview_cancel)
                        setOnClickListener {
                            setResult(RESULT_CANCELED)
                            finish()
                        }
                    },
                )
            }

        val root =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(header)
                addView(
                    webView,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.MATCH_PARENT,
                    ),
                )
            }
        setContentView(root)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        setResult(RESULT_CANCELED)
                        finish()
                    }
                }
            },
        )

        webView.loadUrl(authorizationUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(view: WebView) {
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }
        view.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?,
                ): Boolean {
                    val target = request?.url ?: return false
                    if (matchesOAuthRedirect(target)) {
                        completeWithRedirect(target)
                        return true
                    }
                    if (!isTrustedNavigationUrl(target)) {
                        Log.w(TAG, "SSO WebView blocked navigation host=${target.host}")
                        return true
                    }
                    return false
                }

                @Deprecated("Deprecated in API 24+")
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    url: String?,
                ): Boolean {
                    val target = url?.let(Uri::parse) ?: return false
                    if (matchesOAuthRedirect(target)) {
                        completeWithRedirect(target)
                        return true
                    }
                    if (!isTrustedNavigationUrl(target)) {
                        Log.w(TAG, "SSO WebView blocked navigation host=${target.host}")
                        return true
                    }
                    return false
                }
            }
    }

    private fun completeWithRedirect(uri: Uri) {
        setResult(RESULT_OK, Intent().setData(uri))
        finish()
    }

    private fun matchesOAuthRedirect(candidate: Uri): Boolean {
        if (!candidate.scheme.equals(redirectUri.scheme, ignoreCase = true)) return false
        val expectedPath = MobileOAuthRedirectUris.pathKey(redirectUri)
        val actualPath = MobileOAuthRedirectUris.pathKey(candidate)
        return expectedPath.isNotEmpty() && expectedPath == actualPath
    }

    companion object {
        private const val TAG = "EmperySsoWebView"
        private const val EXTRA_AUTHORIZATION_URL = "world.empery.mobile.extra.SSO_AUTHORIZATION_URL"
        private const val EXTRA_REDIRECT_URI = "world.empery.mobile.extra.SSO_REDIRECT_URI"

        fun createIntent(
            context: Context,
            authorizationUrl: String,
            redirectUri: String,
        ): Intent =
            Intent(context, EmperySsoWebViewActivity::class.java).apply {
                putExtra(EXTRA_AUTHORIZATION_URL, authorizationUrl)
                putExtra(EXTRA_REDIRECT_URI, redirectUri)
                // Activity Result must return to the caller Activity. NEW_TASK / CLEAR_TOP
                // (and former singleTask launchMode) deliver RESULT_CANCELED immediately.
                flags = 0
            }

        fun isTrustedAuthorizationUrl(raw: String): Boolean {
            val uri = Uri.parse(raw.trim())
            return isTrustedNavigationUrl(uri)
        }

        fun isTrustedNavigationUrl(uri: Uri): Boolean {
            if (uri.scheme?.lowercase(Locale.US) != "https") return false
            val host = uri.host?.lowercase(Locale.US) ?: return false
            return host == "eliteew.ru" || host.endsWith(".eliteew.ru")
        }
    }
}
