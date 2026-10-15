/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-auth notification + core runtime permission launchers, rationale dialogs, and
 * denied banners extracted from MainActivity MobileRoot.
 *
 * Invariants:
 * - ActivityResultLaunchers are registered in Compose (rememberLauncherForActivityResult);
 *   callers pass nothing Activity-owned beyond the composition tree.
 * - Rationale prefs stay in MobilePermissionSetupPrefs / NotificationPermissionSetupPrefs /
 *   FullScreenIntentPermissionSetupPrefs.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - MainActivity MobileRoot, MobilePermissionSetup.kt, NotificationPermissionUi,
 *   FullScreenIntentPermissionUi, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.Manifest
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import feature.notifications.FullScreenIntentPermissionDeniedBanner
import feature.notifications.FullScreenIntentPermissionRationaleDialog
import feature.notifications.FullScreenIntentPermissionSetupPrefs
import feature.notifications.NotificationPermissionDeniedBanner
import feature.notifications.NotificationPermissionRationaleDialog
import feature.notifications.NotificationPermissionSetupPrefs
import feature.notifications.canUseFullScreenIntent
import feature.notifications.fullScreenIntentSettingsIntent
import feature.notifications.openNotificationSettings
import feature.notifications.requiresFullScreenIntentPermissionPrompt
import world.empery.mobile.core.ui.MobilePermissions
import world.empery.mobile.observability.MobileTelemetry

private const val PERMISSION_SHELL_TAG = "MobilePermissionShell"

/**
 * Decision for core (non-notification) runtime permissions after auth.
 * Pure helper — unit-tested; Compose shell applies the side effects.
 */
internal enum class CoreAppPermissionPrompt {
    ShowRationale,
    MarkDenied,
    None,
}

internal fun resolveCoreAppPermissionPrompt(
    missingCore: Collection<String>,
    shouldShowRationale: Boolean,
): CoreAppPermissionPrompt =
    when {
        missingCore.isEmpty() -> CoreAppPermissionPrompt.None
        shouldShowRationale -> CoreAppPermissionPrompt.ShowRationale
        else -> CoreAppPermissionPrompt.MarkDenied
    }

/** Decision for Android 14+ full-screen intent special access (incoming calls). */
internal enum class FullScreenIntentPermissionPrompt {
    ShowRationale,
    ShowDeniedBanner,
    None,
}

internal fun resolveFullScreenIntentPermissionPrompt(
    requiresPrompt: Boolean,
    canUse: Boolean,
    shouldShowRationale: Boolean,
): FullScreenIntentPermissionPrompt =
    when {
        !requiresPrompt || canUse -> FullScreenIntentPermissionPrompt.None
        shouldShowRationale -> FullScreenIntentPermissionPrompt.ShowRationale
        else -> FullScreenIntentPermissionPrompt.ShowDeniedBanner
    }

data class MobilePermissionShellState(
    val postNotificationsGranted: Boolean,
    val fullScreenIntentGranted: Boolean,
    val fullScreenIntentDeniedBanner: Boolean,
    val appPermissionsDenied: Boolean,
    val requestNotificationPermission: () -> Unit,
    val requestFullScreenIntentPermission: () -> Unit,
    val requestCoreAppPermissions: () -> Unit,
    val requestAllAppPermissions: () -> Unit,
)

/**
 * Registers permission launchers and drives post-auth rationale prompts.
 * Renders rationale dialogs as a side effect of composition (same as pre-split MobileRoot).
 */
@Composable
fun rememberMobilePermissionShell(
    isAuthenticated: Boolean,
    privateTunnelBootstrapBlocked: Boolean = false,
): MobilePermissionShellState {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var showAppPermissionsRationale by remember { mutableStateOf(false) }
    var showNotificationPermissionRationale by remember { mutableStateOf(false) }
    var showFullScreenIntentRationale by remember { mutableStateOf(false) }
    var appPermissionsDenied by remember { mutableStateOf(false) }
    var fullScreenIntentGranted by remember {
        mutableStateOf(canUseFullScreenIntent(context))
    }
    var fullScreenIntentDeniedBanner by remember { mutableStateOf(false) }

    fun refreshFullScreenIntentState() {
        val granted = canUseFullScreenIntent(context)
        fullScreenIntentGranted = granted
        if (granted) {
            fullScreenIntentDeniedBanner = false
        } else if (
            requiresFullScreenIntentPermissionPrompt() &&
            !FullScreenIntentPermissionSetupPrefs.shouldShowRationale(context)
        ) {
            fullScreenIntentDeniedBanner = true
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) {
                    refreshFullScreenIntentState()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val maybePromptCorePermissions: () -> Unit = {
        when (
            resolveCoreAppPermissionPrompt(
                missingCore =
                    MobilePermissions.missingPermissions(
                        context,
                        MobilePermissions.coreRuntimePermissions(),
                    ),
                shouldShowRationale = MobilePermissionSetupPrefs.shouldShowRationale(context),
            )
        ) {
            CoreAppPermissionPrompt.ShowRationale -> showAppPermissionsRationale = true
            CoreAppPermissionPrompt.MarkDenied -> appPermissionsDenied = true
            CoreAppPermissionPrompt.None -> Unit
        }
    }

    val maybePromptFullScreenIntent: () -> Unit = {
        when (
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = requiresFullScreenIntentPermissionPrompt(),
                canUse = canUseFullScreenIntent(context),
                shouldShowRationale = FullScreenIntentPermissionSetupPrefs.shouldShowRationale(context),
            )
        ) {
            FullScreenIntentPermissionPrompt.ShowRationale -> showFullScreenIntentRationale = true
            FullScreenIntentPermissionPrompt.ShowDeniedBanner -> {
                fullScreenIntentDeniedBanner = true
                maybePromptCorePermissions()
            }
            FullScreenIntentPermissionPrompt.None -> maybePromptCorePermissions()
        }
    }

    val notificationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { granted ->
            NotificationPermissionSetupPrefs.markRationaleHandled(context)
            showNotificationPermissionRationale = false
            if (granted) {
                MobileTelemetry.trackBusinessEvent("push_permission_granted")
            } else {
                MobileTelemetry.trackBusinessEvent("push_permission_denied")
            }
            (context.applicationContext as MobileApp).scheduleFcmTokenSyncWithBackend()
            maybePromptFullScreenIntent()
        }

    val requestNotificationPermission: () -> Unit = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !MobilePermissions.isPostNotificationGranted(context)
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val fullScreenIntentSettingsLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
        ) {
            FullScreenIntentPermissionSetupPrefs.markRationaleHandled(context)
            showFullScreenIntentRationale = false
            refreshFullScreenIntentState()
            if (canUseFullScreenIntent(context)) {
                MobileTelemetry.trackBusinessEvent("fullscreen_intent_permission_granted")
            } else {
                MobileTelemetry.trackBusinessEvent("fullscreen_intent_permission_denied")
                fullScreenIntentDeniedBanner = true
            }
            maybePromptCorePermissions()
        }

    val requestFullScreenIntentPermission: () -> Unit = {
        if (requiresFullScreenIntentPermissionPrompt() && !canUseFullScreenIntent(context)) {
            fullScreenIntentSettingsLauncher.launch(fullScreenIntentSettingsIntent(context))
        }
    }

    val appPermissionsLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            MobilePermissionSetupPrefs.markHandled(context)
            showAppPermissionsRationale = false
            appPermissionsDenied = results.values.any { !it }
            (context.applicationContext as MobileApp).scheduleFcmTokenSyncWithBackend()
        }

    val requestCoreAppPermissions: () -> Unit = {
        val missing =
            MobilePermissions.missingPermissions(context, MobilePermissions.coreRuntimePermissions())
        if (missing.isEmpty()) {
            appPermissionsDenied = false
        } else {
            appPermissionsLauncher.launch(missing.toTypedArray())
        }
    }

    val requestAllAppPermissions: () -> Unit = {
        requestNotificationPermission()
        requestFullScreenIntentPermission()
        requestCoreAppPermissions()
    }

    LaunchedEffect(isAuthenticated, privateTunnelBootstrapBlocked) {
        if (!isAuthenticated) {
            showAppPermissionsRationale = false
            showNotificationPermissionRationale = false
            showFullScreenIntentRationale = false
            appPermissionsDenied = false
            fullScreenIntentDeniedBanner = false
            return@LaunchedEffect
        }
        // Match pre-split MobileRoot: defer permission prompts until private tunnel is ready.
        if (privateTunnelBootstrapBlocked) {
            return@LaunchedEffect
        }
        val app = context.applicationContext as MobileApp
        app.scheduleFcmTokenSyncWithBackend()
        refreshFullScreenIntentState()
        val missingNotification = MobilePermissions.missingPostNotificationPermissions(context)
        if (missingNotification.isNotEmpty() &&
            NotificationPermissionSetupPrefs.shouldShowRationale(context)
        ) {
            showNotificationPermissionRationale = true
            return@LaunchedEffect
        }
        when (
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = requiresFullScreenIntentPermissionPrompt(),
                canUse = canUseFullScreenIntent(context),
                shouldShowRationale = FullScreenIntentPermissionSetupPrefs.shouldShowRationale(context),
            )
        ) {
            FullScreenIntentPermissionPrompt.ShowRationale -> {
                showFullScreenIntentRationale = true
                return@LaunchedEffect
            }
            FullScreenIntentPermissionPrompt.ShowDeniedBanner -> fullScreenIntentDeniedBanner = true
            FullScreenIntentPermissionPrompt.None -> Unit
        }
        when (
            resolveCoreAppPermissionPrompt(
                missingCore =
                    MobilePermissions.missingPermissions(
                        context,
                        MobilePermissions.coreRuntimePermissions(),
                    ),
                shouldShowRationale = MobilePermissionSetupPrefs.shouldShowRationale(context),
            )
        ) {
            CoreAppPermissionPrompt.ShowRationale -> showAppPermissionsRationale = true
            CoreAppPermissionPrompt.MarkDenied -> appPermissionsDenied = true
            CoreAppPermissionPrompt.None -> Unit
        }
    }

    NotificationPermissionRationaleDialog(
        visible = showNotificationPermissionRationale,
        onConfirm = {
            showNotificationPermissionRationale = false
            NotificationPermissionSetupPrefs.markRationaleHandled(context)
            requestNotificationPermission()
        },
        onDismiss = {
            showNotificationPermissionRationale = false
            NotificationPermissionSetupPrefs.markRationaleHandled(context)
            maybePromptFullScreenIntent()
        },
    )

    FullScreenIntentPermissionRationaleDialog(
        visible = showFullScreenIntentRationale,
        onConfirm = {
            showFullScreenIntentRationale = false
            FullScreenIntentPermissionSetupPrefs.markRationaleHandled(context)
            requestFullScreenIntentPermission()
        },
        onDismiss = {
            showFullScreenIntentRationale = false
            FullScreenIntentPermissionSetupPrefs.markRationaleHandled(context)
            fullScreenIntentDeniedBanner = !canUseFullScreenIntent(context)
            maybePromptCorePermissions()
        },
    )

    AppPermissionsRationaleDialog(
        visible = showAppPermissionsRationale,
        onConfirm = {
            showAppPermissionsRationale = false
            MobilePermissionSetupPrefs.markHandled(context)
            requestCoreAppPermissions()
        },
        onDismiss = {
            showAppPermissionsRationale = false
            MobilePermissionSetupPrefs.markHandled(context)
            appPermissionsDenied =
                MobilePermissions.missingPermissions(
                    context,
                    MobilePermissions.coreRuntimePermissions(),
                ).isNotEmpty()
        },
    )

    return MobilePermissionShellState(
        postNotificationsGranted = MobilePermissions.isPostNotificationGranted(context),
        fullScreenIntentGranted = fullScreenIntentGranted,
        fullScreenIntentDeniedBanner = fullScreenIntentDeniedBanner,
        appPermissionsDenied = appPermissionsDenied,
        requestNotificationPermission = requestNotificationPermission,
        requestFullScreenIntentPermission = requestFullScreenIntentPermission,
        requestCoreAppPermissions = requestCoreAppPermissions,
        requestAllAppPermissions = requestAllAppPermissions,
    )
}

/**
 * Deferred authenticated warmup log helper (kept next to permission gate for operators).
 */
fun logPermissionShellWarmupDeferred() {
    Log.i(PERMISSION_SHELL_TAG, "Authenticated startup warmup deferred until private tunnel is connected")
}

@Composable
fun MobilePermissionShellBanners(
    isAuthenticated: Boolean,
    state: MobilePermissionShellState,
) {
    val context = LocalContext.current
    NotificationPermissionDeniedBanner(
        visible = isAuthenticated && !state.postNotificationsGranted,
        onOpenSettings = { openNotificationSettings(context) },
        onRetry = state.requestNotificationPermission,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
    )
    FullScreenIntentPermissionDeniedBanner(
        visible =
            isAuthenticated &&
                requiresFullScreenIntentPermissionPrompt() &&
                !state.fullScreenIntentGranted &&
                state.fullScreenIntentDeniedBanner,
        onOpenSettings = state.requestFullScreenIntentPermission,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
    )
    AppPermissionsDeniedBanner(
        visible =
            isAuthenticated &&
                state.appPermissionsDenied &&
                MobilePermissions.missingPermissions(
                    context,
                    MobilePermissions.coreRuntimePermissions(),
                ).isNotEmpty(),
        onOpenSettings = { openAppPermissionSettings(context) },
        onRetry = state.requestCoreAppPermissions,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
    )
}
