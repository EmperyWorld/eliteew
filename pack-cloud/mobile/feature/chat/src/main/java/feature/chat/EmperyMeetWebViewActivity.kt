// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Full-screen WebView host for GAF Meet `join_url` (same contract as desktop VideoCallApp iframe).
// Grants camera/microphone to trusted `*.eliteew.ru` origins via WebChromeClient.
// Invariants:
// - Loads only validated HTTPS join URLs from [GafMeetWebViewLauncher].
// - Meet call chrome: compact PiP (top-start) and end-call (top-end) icon buttons over WebView.
// - User back / leave emits [GafMeetWebViewLauncher.ACTION_GAF_MEET_USER_LEFT]; programmatic end uses
//   [GafMeetWebViewLauncher.ACTION_FINISH_GAF_MEET] without user-left side effects.
// WebView hardening (security-003): no file/content/geo; safe browsing when available.
// Related:
// - GafMeetWebViewLauncher.kt, MainActivity.kt, documentation/product/ewa (VideoCallApp)
// ---
package feature.chat

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.util.Rational
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/** In-app Meet room loaded from API `join_url` (WebView, not Jitsi SDK). */
class EmperyMeetWebViewActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var userLeftBroadcastSent = false
    private var finishingFromApp = false

    private val webMediaPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            val request = pendingWebPermissionRequest ?: return@registerForActivityResult
            pendingWebPermissionRequest = null
            grantAvailableWebResources(request)
        }

    private var callId: String = ""
    private var chatId: String? = null
    private var joinUrl: String = ""
    private var callStartedAtMs: Long = 0L
    private var pageLoadFailed: Boolean = false
    private lateinit var errorOverlay: LinearLayout
    private lateinit var pipControlButton: FrameLayout
    private lateinit var endCallControlButton: FrameLayout
    private lateinit var rootFrame: FrameLayout

    private val finishReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                if (intent?.action != GafMeetWebViewLauncher.ACTION_FINISH_GAF_MEET) return
                val targetCallId = intent.getStringExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID)
                if (targetCallId != null && targetCallId != callId) return
                finishingFromApp = true
                finish()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!readIntentExtras(intent)) {
            finish()
            return
        }

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        volumeControlStream = AudioManager.STREAM_VOICE_CALL

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
                        text = getString(R.string.chat_meet_webview_error_title)
                        setTextColor(0xFFFFFFFF.toInt())
                        textSize = 18f
                        gravity = Gravity.CENTER
                    },
                )
                addView(
                    TextView(context).apply {
                        text = getString(R.string.chat_meet_webview_error_body)
                        setTextColor(0xCCFFFFFF.toInt())
                        textSize = 14f
                        gravity = Gravity.CENTER
                        setPadding(0, 24, 0, 24)
                    },
                )
                addView(
                    Button(context).apply {
                        text = getString(R.string.chat_meet_webview_retry)
                        setOnClickListener {
                            pageLoadFailed = false
                            visibility = View.GONE
                            webView.reload()
                        }
                    },
                )
                addView(
                    Button(context).apply {
                        text = getString(R.string.chat_meet_webview_close)
                        setOnClickListener {
                            notifyUserLeftMeet()
                            finish()
                        }
                    },
                )
            }
        val overlayEdgePaddingPx = (resources.displayMetrics.density * 12).toInt()
        val callControlSizePx = (resources.displayMetrics.density * 48).toInt()
        pipControlButton =
            createMeetOverlayIconButton(
                iconRes = R.drawable.ic_picture_in_picture_white,
                contentDescription = getString(R.string.chat_video_call_pip_cd),
                backgroundColor = 0xE637474F.toInt(),
                onClick = { enterPipOrBackground() },
            )
        endCallControlButton =
            createMeetOverlayIconButton(
                iconRes = R.drawable.ic_call_end_white,
                contentDescription = getString(R.string.chat_video_call_end),
                backgroundColor = 0xE6D32F2F.toInt(),
                onClick = {
                    notifyUserLeftMeet()
                    finish()
                },
            )
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
                addView(
                    pipControlButton,
                    FrameLayout.LayoutParams(callControlSizePx, callControlSizePx).apply {
                        gravity = Gravity.TOP or Gravity.START
                        topMargin = overlayEdgePaddingPx
                        marginStart = overlayEdgePaddingPx
                    },
                )
                addView(
                    endCallControlButton,
                    FrameLayout.LayoutParams(callControlSizePx, callControlSizePx).apply {
                        gravity = Gravity.TOP or Gravity.END
                        topMargin = overlayEdgePaddingPx
                        marginEnd = overlayEdgePaddingPx
                    },
                )
            }
        setContentView(rootFrame)
        ViewCompat.setOnApplyWindowInsetsListener(rootFrame) { _, insets ->
            val safeInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.systemBars())
            (pipControlButton.layoutParams as FrameLayout.LayoutParams).apply {
                topMargin = safeInsets.top + overlayEdgePaddingPx
                marginStart = safeInsets.left + overlayEdgePaddingPx
            }
            (endCallControlButton.layoutParams as FrameLayout.LayoutParams).apply {
                topMargin = safeInsets.top + overlayEdgePaddingPx
                marginEnd = safeInsets.right + overlayEdgePaddingPx
            }
            pipControlButton.requestLayout()
            endCallControlButton.requestLayout()
            insets
        }

        enableWebViewDebuggingForDebugBuilds()
        enterImmersiveMode()
        configureWebView()
        configureBackNavigation()

        LocalBroadcastManager.getInstance(this).registerReceiver(
            finishReceiver,
            IntentFilter(GafMeetWebViewLauncher.ACTION_FINISH_GAF_MEET),
        )

        requestAudioFocus()
        webView.loadUrl(joinUrl)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!readIntentExtras(intent)) {
            finish()
            return
        }
        reloadMeetSession()
    }

    /** Full in-place reset for repeat calls on singleTask activity (avoids stale colibri/Jitsi state). */
    private fun reloadMeetSession() {
        pageLoadFailed = false
        userLeftBroadcastSent = false
        finishingFromApp = false
        if (::errorOverlay.isInitialized) {
            errorOverlay.visibility = View.GONE
        }
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        webView.stopLoading()
        webView.clearHistory()
        requestAudioFocus()
        webView.loadUrl(joinUrl)
        Log.i(TAG, "meet session reloaded callId=$callId")
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (!isFinishing && !pageLoadFailed) {
            enterPipOrBackground()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration,
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (::pipControlButton.isInitialized && ::endCallControlButton.isInitialized) {
            val visibility = if (isInPictureInPictureMode) View.GONE else View.VISIBLE
            pipControlButton.visibility = visibility
            endCallControlButton.visibility = visibility
        }
        if (!isInPictureInPictureMode && !isFinishing) {
            enterImmersiveMode()
        }
    }

    override fun onResume() {
        super.onResume()
        if (!isInPictureInPictureMode) {
            enterImmersiveMode()
        }
        requestAudioFocus()
        webView.onResume()
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        if (!isInPictureInPictureMode) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        LocalBroadcastManager.getInstance(this).unregisterReceiver(finishReceiver)
        notifyCallEndedSummary()
        if (!finishingFromApp) {
            notifyUserLeftMeet()
        }
        abandonAudioFocus()
        webView.destroy()
        super.onDestroy()
    }

    private fun readIntentExtras(intent: Intent?): Boolean {
        val url = intent?.getStringExtra(GafMeetWebViewLauncher.EXTRA_JOIN_URL).orEmpty()
        if (!GafMeetWebViewLauncher.isValidJoinUrl(url)) {
            Log.w(TAG, "invalid or missing join_url")
            return false
        }
        joinUrl = url.trim()
        callId = intent?.getStringExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID).orEmpty()
        chatId = intent?.getStringExtra(GafMeetWebViewLauncher.EXTRA_CHAT_ID)?.trim()?.ifBlank { null }
        callStartedAtMs = System.currentTimeMillis()
        return true
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            loadWithOverviewMode = true
            useWideViewPort = true
            javaScriptCanOpenWindowsAutomatically = true
            cacheMode = WebSettings.LOAD_DEFAULT

            allowFileAccess = false
            allowContentAccess = false
            setGeolocationEnabled(false)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.webChromeClient =
            object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread { handleWebPermissionRequest(request) }
                }
            }

        webView.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {

                    if (request.url.scheme == "file" || request.url.scheme == "content") {
                        Log.w(TAG, "blocked navigation to scheme=${request.url.scheme}")
                        return true
                    }
                    val host = request.url.host
                    return if (GafMeetWebViewLauncher.isTrustedEmperyHost(host)) {
                        false
                    } else {
                        Log.w(TAG, "blocked navigation to untrusted host=$host")
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
                    runOnUiThread {
                        errorOverlay.visibility = View.VISIBLE
                    }
                    Log.w(TAG, "meet page error code=${error.errorCode} desc=${error.description}")
                }

                override fun onPageFinished(
                    view: WebView,
                    url: String,
                ) {
                    super.onPageFinished(view, url)
                    CookieManager.getInstance().flush()
                    if (!pageLoadFailed) {
                        errorOverlay.visibility = View.GONE
                    }
                    Log.i(TAG, "meet page finished url=$url")
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
                        enterPipOrBackground()
                    }
                }
            },
        )
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        if (!GafMeetWebViewLauncher.isTrustedEmperyHost(request.origin.host)) {
            Log.w(TAG, "denying WebView permission for untrusted origin=${request.origin}")
            request.deny()
            return
        }

        val missing =
            androidPermissionsForWebResources(request.resources).filter { permission ->
                ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
            }

        if (missing.isEmpty()) {
            grantAvailableWebResources(request)
            return
        }

        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = request
        webMediaPermissionLauncher.launch(missing.toTypedArray())
    }

    private fun androidPermissionsForWebResources(resources: Array<String>): List<String> =
        buildList {
            if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                add(Manifest.permission.RECORD_AUDIO)
            }
            if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                add(Manifest.permission.CAMERA)
            }
        }.distinct()

    private fun grantAvailableWebResources(request: PermissionRequest) {
        val grantable =
            request.resources.filter { resource ->
                when (resource) {
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                            PackageManager.PERMISSION_GRANTED

                    PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED

                    else -> true
                }
            }
        if (grantable.isEmpty()) {
            Log.w(TAG, "denying WebView permission: no grantable resources origin=${request.origin}")
            request.deny()
        } else {
            request.grant(grantable.toTypedArray())
        }
    }

    private fun notifyCallEndedSummary() {
        if (callId.isBlank()) return
        val durationSec = ((System.currentTimeMillis() - callStartedAtMs) / 1000L).coerceAtLeast(0L)
        LocalBroadcastManager.getInstance(this).sendBroadcast(
            Intent(GafMeetWebViewLauncher.ACTION_GAF_MEET_CALL_ENDED).apply {
                putExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID, callId)
                chatId?.let { putExtra(GafMeetWebViewLauncher.EXTRA_CHAT_ID, it) }
                putExtra(GafMeetWebViewLauncher.EXTRA_DURATION_SECONDS, durationSec)
            },
        )
    }

    private fun notifyUserLeftMeet() {
        if (userLeftBroadcastSent) return
        userLeftBroadcastSent = true
        LocalBroadcastManager.getInstance(this).sendBroadcast(
            Intent(GafMeetWebViewLauncher.ACTION_GAF_MEET_USER_LEFT).apply {
                putExtra(GafMeetWebViewLauncher.EXTRA_CALL_ID, callId)
            },
        )
    }

    private fun requestAudioFocus() {
        val result =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attributes =
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                val request =
                    AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attributes)
                        .setOnAudioFocusChangeListener { }
                        .build()
                audioFocusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN,
                )
            }

        if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            Log.w(TAG, "audio focus was not granted")
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
        audioFocusRequest = null
    }

    private fun enableWebViewDebuggingForDebugBuilds() {
        val isDebuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        if (isDebuggable) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    private fun enterImmersiveMode() {
        if (isInPictureInPictureMode) return
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun supportsPictureInPictureMode(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

    private fun enterPipOrBackground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && supportsPictureInPictureMode()) {
            val params =
                PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
            if (enterPictureInPictureMode(params)) {
                if (::pipControlButton.isInitialized && ::endCallControlButton.isInitialized) {
                    pipControlButton.visibility = View.GONE
                    endCallControlButton.visibility = View.GONE
                }
                return
            }
        }
        moveTaskToBack(false)
    }

    private fun createMeetOverlayIconButton(
        iconRes: Int,
        contentDescription: CharSequence,
        backgroundColor: Int,
        onClick: () -> Unit,
    ): FrameLayout {
        val density = resources.displayMetrics.density
        val buttonSizePx = (48 * density).toInt()
        val iconSizePx = (22 * density).toInt()
        val strokePx = (1.25f * density).toInt().coerceAtLeast(1)
        return FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(buttonSizePx, buttonSizePx)
            this.contentDescription = contentDescription
            isClickable = true
            isFocusable = true
            foreground = ContextCompat.getDrawable(context, android.R.drawable.list_selector_background)?.mutate()
            background =
                GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(backgroundColor)
                    setStroke(strokePx, 0x40FFFFFF)
                }
            setOnClickListener { onClick() }
            addView(
                ImageView(context).apply {
                    setImageResource(iconRes)
                    imageTintList = ColorStateList.valueOf(Color.WHITE)
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                    layoutParams =
                        FrameLayout.LayoutParams(iconSizePx, iconSizePx, Gravity.CENTER)
                },
            )
        }
    }

    private companion object {
        private const val TAG = "EmperyMeetWebView"
    }
}
