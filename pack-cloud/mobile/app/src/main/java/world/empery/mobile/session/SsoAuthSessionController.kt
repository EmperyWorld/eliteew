/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSO login launch/callback/session-replace orchestration owned by MainViewModel (W1 atomization).
 *
 * Invariants:
 * - Public API stays on MainViewModel as thin delegates for Activity/shell call-site stability.
 * - Successful exchange is accepted only via shouldAcceptSsoExchange (tokens persisted).
 * - Duplicate completeSsoLoginFromCallback is ignored when already authenticated (VIEW vs WebView race).
 *
 * Related:
 * - MainViewModel, MobileSsoAuthLauncher, MobileAuthSessionPolicy, AuthRepository
 */
package world.empery.mobile.session

import android.app.Application
import android.content.Intent
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import world.empery.mobile.AppRuntimeConfig
import world.empery.mobile.MainUiState
import world.empery.mobile.R
import world.empery.mobile.core.auth.AuthErrorParser
import world.empery.mobile.core.auth.MobileOAuthRedirectUris
import world.empery.mobile.core.auth.MobileSsoAuthLauncher
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceRequest
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceResult
import world.empery.mobile.core.auth.MobileSsoLaunchPlan
import world.empery.mobile.core.auth.OidcLoginCallback
import world.empery.mobile.core.auth.SsoExchangeConfirmationRequiredException
import world.empery.mobile.core.auth.SsoExchangeException
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shouldAcceptSsoExchange

private fun Throwable.isLikelyLoginTimeout(): Boolean =
    when (this) {
        is SocketTimeoutException -> true
        is InterruptedIOException ->
            localizedMessage?.contains("timeout", ignoreCase = true) == true ||
                message?.contains("timeout", ignoreCase = true) == true
        else -> false
    } ||
        cause?.isLikelyLoginTimeout() == true ||
        message?.contains("timeout", ignoreCase = true) == true ||
        localizedMessage?.contains("timeout", ignoreCase = true) == true

internal fun Application.humanizeLoginFailure(err: Throwable): String =
    when (err) {
        is SsoExchangeConfirmationRequiredException ->
            getString(R.string.app_auth_session_replace_required)
        is SsoExchangeException ->
            when (err.reason) {
                AuthErrorParser.REASON_SESSION_REPLACED ->
                    getString(R.string.app_auth_session_replaced_login)
                AuthErrorParser.REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED ->
                    getString(R.string.app_auth_session_replace_required)
                AuthErrorParser.REASON_TOKEN_EXPIRED,
                AuthErrorParser.REASON_INVALID_TOKEN,
                ->
                    getString(R.string.auth_session_refresh_rejected_snackbar)
                else -> err.message?.takeIf { it.isNotBlank() && !it.contains("Exception") }
                    ?: getString(R.string.app_auth_login_failed)
            }
        else -> {
            if (err.isLikelyLoginTimeout()) {
                getString(R.string.app_auth_login_timeout)
            } else {
                when (AuthErrorParser.parseReasonFromText(err.message)) {
                    AuthErrorParser.REASON_SESSION_REPLACED ->
                        getString(R.string.app_auth_session_replaced_login)
                    AuthErrorParser.REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED ->
                        getString(R.string.app_auth_session_replace_required)
                    else -> getString(R.string.app_auth_login_failed)
                }
            }
        }
    }

/** Post-login / auth-error hooks implemented by MainViewModel. */
interface SsoAuthSessionHost {
    fun application(): Application

    fun runtimeConfig(): AppRuntimeConfig

    fun mainState(): MutableStateFlow<MainUiState>

    fun appString(resId: Int): String

    fun onSsoLoginSucceeded()

    fun markAppUnlocked()
}

/**
 * Owns SSO launch plan, AppAuth callback parsing, and authorization-code exchange.
 * Logout / session teardown remain on MainViewModel (cross-domain chat/realtime cleanup).
 */
class SsoAuthSessionController(
    private val scope: CoroutineScope,
    private val container: AppContainer,
    private val host: SsoAuthSessionHost,
) {
    private val mainState: MutableStateFlow<MainUiState>
        get() = host.mainState()

    fun prepareSsoLoginLaunchPlan(): MobileSsoLaunchPlan {
        container.authRepository.beginNewLoginAttempt()
        val loginRequest = container.oidcAuthManager.createLoginRequest()
        container.authRepository.setPendingLogin(
            loginRequest.state,
            loginRequest.codeVerifier,
            loginRequest.redirectUri,
        )
        mainState.update {
            it.copy(authInProgress = true, authError = null, sessionReplaceConfirmVisible = false)
        }
        return MobileSsoAuthLauncher.planLaunch(
            context = host.application(),
            oidcAuthManager = container.oidcAuthManager,
            loginRequest = loginRequest,
        )
    }

    fun resolveSsoLoginAfterBrowserChoice(
        request: MobileSsoBrowserChoiceRequest,
        result: MobileSsoBrowserChoiceResult,
    ): Intent? =
        MobileSsoAuthLauncher.createLaunchIntentAfterBrowserChoice(
            context = host.application(),
            oidcAuthManager = container.oidcAuthManager,
            loginRequest = request.loginRequest,
            result = result,
        )

    fun dismissSessionReplaceConfirm() {
        container.authRepository.dismissReplaceConfirmForNextExchange()
        mainState.update { it.copy(sessionReplaceConfirmVisible = false, authInProgress = false) }
    }

    fun confirmSessionReplaceAndPrepareLogin(): MobileSsoLaunchPlan {
        container.authRepository.markReplaceConfirmForNextExchange()
        return prepareSsoLoginLaunchPlan()
    }

    fun onSsoLoginCanceled() {
        mainState.update { it.copy(authInProgress = false) }
    }

    fun handleAppAuthCallbackResult(intent: Intent?) {
        if (mainState.value.isAuthenticated) return
        if (intent == null) {
            onSsoLoginCanceled()
            return
        }
        when (val result = container.oidcAuthManager.parseLoginCallback(intent)) {
            is OidcLoginCallback.Success ->
                completeSsoLoginFromCallback(
                    code = result.code,
                    state = result.state,
                )
            is OidcLoginCallback.Canceled -> onSsoLoginCanceled()
            is OidcLoginCallback.Error -> setAuthError(result.userMessage)
        }
    }

    fun completeSsoLoginFromCallback(
        code: String?,
        state: String?,
    ) = scope.launch {
        // MainActivity VIEW intent-filter can race with WebView Activity Result for the same
        // redirect; ignore duplicate completion once the shell is already authenticated.
        if (mainState.value.isAuthenticated) return@launch
        if (code.isNullOrBlank()) {
            mainState.update { it.copy(authError = host.appString(R.string.app_auth_callback_missing_code)) }
            return@launch
        }

        mainState.update { it.copy(authInProgress = true, authError = null) }
        runCatching {
            container.authRepository.exchangeAuthorizationCode(
                code = code,
                state = state,
                redirectUri = host.runtimeConfig().keycloakRedirectUri.let(
                    MobileOAuthRedirectUris::canonicalize,
                ),
            )
        }.onSuccess { exchanged ->
            if (!shouldAcceptSsoExchange(exchanged, container.authRepository.hasSession())) {
                mainState.update {
                    it.copy(
                        isAuthenticated = false,
                        authInProgress = false,
                        authError = host.appString(R.string.app_auth_login_failed),
                    )
                }
                return@onSuccess
            }
            mainState.update {
                it.copy(
                    isAuthenticated = true,
                    authInProgress = false,
                    authError = null,
                )
            }
            host.markAppUnlocked()
            host.onSsoLoginSucceeded()
        }.onFailure { err ->
            if (err is CancellationException) throw err
            if (err is SsoExchangeConfirmationRequiredException) {
                mainState.update {
                    it.copy(
                        authInProgress = false,
                        authError = null,
                        sessionReplaceConfirmVisible = true,
                    )
                }
                return@launch
            }
            MobileTelemetry.reportError(err, "completeSsoLoginFromCallback failed")
            mainState.update {
                it.copy(
                    authInProgress = false,
                    authError = host.application().humanizeLoginFailure(err),
                )
            }
        }
    }

    fun clearAuthError() {
        mainState.update { it.copy(authError = null) }
    }

    fun setAuthError(message: String) {
        mainState.update {
            it.copy(
                authInProgress = false,
                authError = message,
            )
        }
    }
}
