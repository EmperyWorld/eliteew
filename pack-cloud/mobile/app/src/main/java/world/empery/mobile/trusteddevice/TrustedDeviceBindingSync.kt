/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure trusted-device binding resolver: map server list payload to bound/unbound UI truth.
 *
 * Invariants:
 * - Only `status=active` rows may produce a server-bound state.
 * - Binding applies when `stable_device_id` or known active device id matches this phone.
 * - Empty active list with a prior server-bound device id and local material means revoke (API hides inactive rows).
 *
 * Related:
 * - ProfileTabViewModel, MobileTrustedDeviceApi, MOBILE-TRUSTED-DEVICE-BINDING.md
 */
package world.empery.mobile.trusteddevice

import world.empery.mobile.core.network.api.MobileTrustedDeviceDto

enum class TrustedDeviceServerBindingAction {
    APPLY_ACTIVE_DEVICE,
    CLEAR_SERVER_BINDING,
    CLEAR_LOCAL_AND_SERVER_BINDING,
    SYNC_INCONCLUSIVE,
}

data class TrustedDeviceServerBindingResolution(
    val action: TrustedDeviceServerBindingAction,
    val device: MobileTrustedDeviceDto? = null,
)

object TrustedDeviceBindingSync {
    fun isActiveStatus(status: String?): Boolean =
        status?.trim().equals("active", ignoreCase = true) == true

    private fun stableIdsMatch(
        left: String?,
        right: String?,
    ): Boolean {
        val normalizedLeft = left?.trim().orEmpty()
        val normalizedRight = right?.trim().orEmpty()
        return normalizedLeft.isNotEmpty() &&
            normalizedRight.isNotEmpty() &&
            normalizedLeft == normalizedRight
    }

    fun resolveServerBinding(
        items: List<MobileTrustedDeviceDto>,
        localStableDeviceId: String,
        hasLocalBindingMaterial: Boolean,
        knownActiveDeviceId: String? = null,
    ): TrustedDeviceServerBindingResolution {
        val normalizedKnownActiveDeviceId = knownActiveDeviceId?.trim().orEmpty()
        val activeDevices = items.filter { item -> isActiveStatus(item.status) }
        val revokedMine =
            items.any { item ->
                !isActiveStatus(item.status) &&
                    stableIdsMatch(item.stableDeviceId, localStableDeviceId)
            }
        if (revokedMine && hasLocalBindingMaterial) {
            return TrustedDeviceServerBindingResolution(
                action = TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING,
            )
        }

        val activeMine =
            activeDevices.firstOrNull { item ->
                stableIdsMatch(item.stableDeviceId, localStableDeviceId)
            }
                ?: activeDevices.firstOrNull { item ->
                    normalizedKnownActiveDeviceId.isNotEmpty() &&
                        item.id.trim() == normalizedKnownActiveDeviceId
                }
        if (activeMine != null) {
            return TrustedDeviceServerBindingResolution(
                action = TrustedDeviceServerBindingAction.APPLY_ACTIVE_DEVICE,
                device = activeMine,
            )
        }

        if (activeDevices.isNotEmpty() && hasLocalBindingMaterial) {
            return TrustedDeviceServerBindingResolution(
                action = TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING,
            )
        }

        if (activeDevices.isEmpty() && hasLocalBindingMaterial) {
            if (normalizedKnownActiveDeviceId.isNotEmpty()) {
                return TrustedDeviceServerBindingResolution(
                    action = TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING,
                )
            }
            return TrustedDeviceServerBindingResolution(
                action = TrustedDeviceServerBindingAction.SYNC_INCONCLUSIVE,
            )
        }

        return TrustedDeviceServerBindingResolution(
            action = TrustedDeviceServerBindingAction.CLEAR_SERVER_BINDING,
        )
    }
}
