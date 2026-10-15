package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.tunnel.MobilePrivateTunnelConfigStore

class MobilePrivateTunnelConfigStoreTest {
    private val sampleConfig =
        """
        [Interface]
        PrivateKey = TEST_PRIVATE_KEY_NOT_USED
        Address = 10.88.88.101/32
        DNS = 10.88.88.1

        [Peer]
        PublicKey = mjbnn5s6WohBAtPEtF8ZD65DquDUQ34tIcWnSQ1Oe2M=
        Endpoint = 93.77.165.185:51822
        AllowedIPs = 10.88.88.1/32
        PersistentKeepalive = 25
        """.trimIndent()

    @Test
    fun parsePeerPublicKeyFromConfig_returnsPeerSectionPublicKey() {
        assertEquals(
            "mjbnn5s6WohBAtPEtF8ZD65DquDUQ34tIcWnSQ1Oe2M=",
            MobilePrivateTunnelConfigStore.parsePeerPublicKeyFromConfig(sampleConfig),
        )
    }

    @Test
    fun parsePeerPublicKeyFromConfig_ignoresInterfacePublicKeyIfPresent() {
        val withInterfacePubkey =
            """
            [Interface]
            PrivateKey = TEST_PRIVATE_KEY_NOT_USED
            PublicKey = 9PkoMzQEFq/Y3aW/RWwOI2viaJiKgNM4x/3aaUKFt1c=
            Address = 10.88.88.101/32

            [Peer]
            PublicKey = mjbnn5s6WohBAtPEtF8ZD65DquDUQ34tIcWnSQ1Oe2M=
            Endpoint = 93.77.165.185:51822
            AllowedIPs = 10.88.88.1/32
            """.trimIndent()

        assertEquals(
            "mjbnn5s6WohBAtPEtF8ZD65DquDUQ34tIcWnSQ1Oe2M=",
            MobilePrivateTunnelConfigStore.parsePeerPublicKeyFromConfig(withInterfacePubkey),
        )
    }

    @Test
    fun parsePeerPublicKeyFromConfig_returnsNullWhenPeerSectionMissing() {
        assertNull(
            MobilePrivateTunnelConfigStore.parsePeerPublicKeyFromConfig(
                """
                [Interface]
                PrivateKey = TEST_PRIVATE_KEY_NOT_USED
                Address = 10.88.88.101/32
                """.trimIndent(),
            ),
        )
    }
}
