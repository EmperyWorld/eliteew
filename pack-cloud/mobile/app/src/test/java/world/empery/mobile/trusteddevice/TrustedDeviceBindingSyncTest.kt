package world.empery.mobile.trusteddevice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.core.network.api.MobileTrustedDeviceDto

class TrustedDeviceBindingSyncTest {
    private val stableId = "9eb32955-1737-43da-a324-85fc03a71339"

    @Test
    fun resolveServerBinding_ignoresRevokedRowsWithoutLocalMaterial() {
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items =
                    listOf(
                        MobileTrustedDeviceDto(
                            id = "45019221-c210-4883-a17d-636225ea59ec",
                            stableDeviceId = stableId,
                            deviceLabel = "HONOR VNE-LX1",
                            status = "revoked",
                        ),
                    ),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = false,
            )

        assertEquals(TrustedDeviceServerBindingAction.CLEAR_SERVER_BINDING, resolution.action)
        assertNull(resolution.device)
    }

    @Test
    fun resolveServerBinding_clearsLocalWhenServerRevokedMine() {
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items =
                    listOf(
                        MobileTrustedDeviceDto(
                            id = "45019221-c210-4883-a17d-636225ea59ec",
                            stableDeviceId = stableId,
                            deviceLabel = "HONOR VNE-LX1",
                            status = "revoked",
                        ),
                    ),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = true,
            )

        assertEquals(
            TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING,
            resolution.action,
        )
    }

    @Test
    fun resolveServerBinding_appliesOnlyMatchingActiveDevice() {
        val device =
            MobileTrustedDeviceDto(
                id = "45019221-c210-4883-a17d-636225ea59ec",
                stableDeviceId = stableId,
                deviceLabel = "HONOR VNE-LX1",
                status = "active",
            )
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items = listOf(device),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = true,
            )

        assertEquals(TrustedDeviceServerBindingAction.APPLY_ACTIVE_DEVICE, resolution.action)
        assertEquals(device, resolution.device)
    }

    @Test
    fun resolveServerBinding_appliesKnownActiveDeviceIdFallback() {
        val device =
            MobileTrustedDeviceDto(
                id = "ca742b4a-1c6e-427d-817c-fbb18055dab9",
                stableDeviceId = "other-stable-id",
                deviceLabel = "HONOR VNE-LX1",
                status = "active",
            )
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items = listOf(device),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = true,
                knownActiveDeviceId = device.id,
            )

        assertEquals(TrustedDeviceServerBindingAction.APPLY_ACTIVE_DEVICE, resolution.action)
        assertEquals(device, resolution.device)
    }

    @Test
    fun resolveServerBinding_doesNotBindForeignActiveDevice() {
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items =
                    listOf(
                        MobileTrustedDeviceDto(
                            id = "other-device",
                            stableDeviceId = "foreign-stable-id",
                            deviceLabel = "Other phone",
                            status = "active",
                        ),
                    ),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = false,
            )

        assertEquals(TrustedDeviceServerBindingAction.CLEAR_SERVER_BINDING, resolution.action)
    }

    @Test
    fun resolveServerBinding_keepsLocalMaterialWhenServerListEmptyWithoutPriorBinding() {
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items = emptyList(),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = true,
            )

        assertEquals(TrustedDeviceServerBindingAction.SYNC_INCONCLUSIVE, resolution.action)
    }

    @Test
    fun resolveServerBinding_clearsLocalWhenServerEmptyButHadKnownDeviceId() {
        val resolution =
            TrustedDeviceBindingSync.resolveServerBinding(
                items = emptyList(),
                localStableDeviceId = stableId,
                hasLocalBindingMaterial = true,
                knownActiveDeviceId = "45019221-c210-4883-a17d-636225ea59ec",
            )

        assertEquals(
            TrustedDeviceServerBindingAction.CLEAR_LOCAL_AND_SERVER_BINDING,
            resolution.action,
        )
    }
}
