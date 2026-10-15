package world.empery.mobile.tabs

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import world.empery.mobile.MobileApp
import world.empery.mobile.di.AppContainer

/** Base for tab-scoped ViewModels that require an authenticated session. */
abstract class AuthenticatedTabViewModel(
    application: Application,
) : AndroidViewModel(application) {
    protected val container: AppContainer = (application as MobileApp).container

    protected fun hasSession(): Boolean = container.authRepository.hasSession()
}
