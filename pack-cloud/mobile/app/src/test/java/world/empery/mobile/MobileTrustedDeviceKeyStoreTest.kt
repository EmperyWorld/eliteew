/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for trusted-device WireGuard config assembly.
 *
 * Invariants:
 * - Tests use dummy keys only and never touch Android Keystore or production tunnel data.
 *
 * Related:
 * - world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore
 */
package world.empery.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.trusteddevice.MobileTrustedDeviceKeyStore
import world.empery.mobile.trusteddevice.MobileTrustedDeviceTunnelMetadata

class MobileTrustedDeviceKeyStoreTest {
    @Test
    fun wireGuardConfigUsesLocalPrivateKeyAndServerMetadata() {
        val config = MobileTrustedDeviceKeyStore.buildWireGuardConfig(
            privateKey = "local-private-key",
            metadata = MobileTrustedDeviceTunnelMetadata(
                interfaceAddress = "10.88.88.101/32",
                dns = "10.88.88.1",
                allowedIps = "10.88.88.1/32",
                endpoint = "edge.example:51822",
                serverPublicKey = "server-public-key",
            ),
        )

        assertTrue(config.contains("PrivateKey = local-private-key"))
        assertTrue(config.contains("Address = 10.88.88.101/32"))
        assertTrue(config.contains("DNS = 10.88.88.1"))
        assertTrue(config.contains("MTU = 1280"))
        assertTrue(config.contains("Endpoint = edge.example:51822"))
        assertTrue(config.contains("AllowedIPs = 10.88.88.1/32"))
        assertFalse(config.contains("wg_public_key_fingerprint"))
    }
}
