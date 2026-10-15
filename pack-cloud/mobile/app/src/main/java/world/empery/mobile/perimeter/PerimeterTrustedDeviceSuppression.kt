/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect when Yandex perimeter access UI and auto-renew must be suppressed because the phone is trusted-device bound.
 *
 * Invariants:
 * - Suppression follows persisted trusted-device binding snapshot, not transient UI sync state.
 *
 * Related:
 * - PerimeterAccessCoordinator, ProfileTabViewModel, MOBILE-SECURE-CONNECTION-OPERATIONS.md
 */
package world.empery.mobile.perimeter

import android.content.Context
import world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore

object PerimeterTrustedDeviceSuppression {
    fun isSuppressed(context: Context): Boolean {
        val keyStore = MobileTrustedDeviceKeyStore(context.applicationContext)
        val snapshot = keyStore.readBindingSnapshot()
        val capability = keyStore.capability()
        return snapshot != null && capability.wireGuardKeyPresent
    }
}
