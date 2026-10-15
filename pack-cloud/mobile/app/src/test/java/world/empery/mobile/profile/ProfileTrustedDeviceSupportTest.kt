package world.empery.mobile.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.core.network.api.MobileTrustedDeviceDto

class ProfileTrustedDeviceSupportTest {
    @Test
    fun tunnelMetadataFromDevice_requiresCompleteFields() {
        assertNull(tunnelMetadataFromDevice(null))
        assertNull(
            tunnelMetadataFromDevice(
                MobileTrustedDeviceDto(
                    id = "d1",
                    deviceLabel = "phone",
                    status = "active",
                    wgAssignedIp = "10.88.88.2",
                    wgDns = null,
                    wgAllowedIps = "0.0.0.0/0",
                    wgEndpoint = "edge.example:51822",
                    wgServerPublicKey = "server-key",
                ),
            ),
        )
        val meta =
            tunnelMetadataFromDevice(
                MobileTrustedDeviceDto(
                    id = "d1",
                    deviceLabel = "phone",
                    status = "active",
                    wgAssignedIp = "10.88.88.2",
                    wgDns = "1.1.1.1",
                    wgAllowedIps = "0.0.0.0/0",
                    wgEndpoint = "edge.example:51822",
                    wgServerPublicKey = "server-key",
                ),
            )
        assertNotNull(meta)
        assertEquals("10.88.88.2/32", meta!!.interfaceAddress)
        assertEquals("1.1.1.1", meta.dns)
        assertEquals("edge.example:51822", meta.endpoint)
    }

    @Test
    fun trustedDevicePairingPayload_holdsFields() {
        val payload =
            TrustedDevicePairingPayload(
                challengeId = "c1",
                pairingCode = "123456",
                challengeNonce = "n1",
            )
        assertEquals("c1", payload.challengeId)
        assertEquals("123456", payload.pairingCode)
        assertEquals("n1", payload.challengeNonce)
    }
}
