/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deeplink recovery flag + pending embedded-SPA deep link store for MainViewModel.
 *
 * Invariants:
 * - consume* clears the pending value (one-shot).
 *
 * Related:
 * - MainViewModel, MobileDeepLinkRouter
 */
package world.empery.mobile.shell

import feature.desktop.PendingEmbeddedSpaDeepLink
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ShellDeeplinkStore {
    private val _deeplinkRecovery = MutableStateFlow(false)
    val deeplinkRecovery: StateFlow<Boolean> = _deeplinkRecovery.asStateFlow()

    private val _pendingEmbeddedSpaDeepLink = MutableStateFlow<PendingEmbeddedSpaDeepLink?>(null)
    val pendingEmbeddedSpaDeepLink: StateFlow<PendingEmbeddedSpaDeepLink?> =
        _pendingEmbeddedSpaDeepLink.asStateFlow()

    fun requestEmbeddedSpaDeepLink(link: PendingEmbeddedSpaDeepLink) {
        _pendingEmbeddedSpaDeepLink.value = link
    }

    fun consumePendingEmbeddedSpaDeepLink(): PendingEmbeddedSpaDeepLink? {
        val pending = _pendingEmbeddedSpaDeepLink.value
        if (pending != null) {
            _pendingEmbeddedSpaDeepLink.value = null
        }
        return pending
    }

    fun consumeDeeplinkRecoveryFlag(): Boolean {
        val v = _deeplinkRecovery.value
        if (v) _deeplinkRecovery.value = false
        return v
    }

    fun signalDeeplinkRecovery() {
        _deeplinkRecovery.value = true
    }
}
