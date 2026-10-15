/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Round-trip tests for GAF Chat E2EE wire crypto (RSA-OAEP + AES-GCM).
 *
 * Invariants:
 * - Encrypt/decrypt roundtrip must match desktop GAFChatCrypto contract.
 *
 * Related:
 * - GafChatE2eeCrypto.kt
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class GafChatE2eeCryptoTest {
    @Test
    fun prepareAndDecrypt_roundTrip_withWrappedSessionKey() {
        val senderSession = GafChatE2eeCrypto.randomSessionKeyBytes()
        val recipientIdentity = GafChatE2eeCrypto.generateIdentityKeyPair()
        val recipientPem = GafChatE2eeCrypto.publicKeyToPem(recipientIdentity.public)
        val plaintext = "привет poet"

        val prepared =
            GafChatE2eeCrypto.prepareMessage(
                plaintext = plaintext,
                sessionKeyBytes = senderSession,
                partnerPublicKeyPem = recipientPem,
            )
        assertNotNull(prepared.sessionKeyForRecipientB64)

        var storedSession: ByteArray? = null
        val decrypted =
            GafChatE2eeCrypto.decryptMessage(
                ciphertextB64 = prepared.ciphertextB64,
                nonceB64 = prepared.nonceB64,
                sessionKeyBytes = null,
                encryptedSessionKeyForMeB64 = prepared.sessionKeyForRecipientB64,
                identityPrivateKey = recipientIdentity.private,
                onSessionKeyStored = { storedSession = it },
            )

        assertEquals(plaintext, decrypted)
        assertNotNull(storedSession)
    }

    @Test
    fun decryptMessage_prefersEnvelopeWhenLocalSessionKeyDiffers() {
        val senderSession = GafChatE2eeCrypto.randomSessionKeyBytes()
        val wrongLocalSession = GafChatE2eeCrypto.randomSessionKeyBytes()
        val recipientIdentity = GafChatE2eeCrypto.generateIdentityKeyPair()
        val recipientPem = GafChatE2eeCrypto.publicKeyToPem(recipientIdentity.public)
        val plaintext = "partner message"

        val prepared =
            GafChatE2eeCrypto.prepareMessage(
                plaintext = plaintext,
                sessionKeyBytes = senderSession,
                partnerPublicKeyPem = recipientPem,
            )

        val decrypted =
            GafChatE2eeCrypto.decryptMessage(
                ciphertextB64 = prepared.ciphertextB64,
                nonceB64 = prepared.nonceB64,
                sessionKeyBytes = wrongLocalSession,
                encryptedSessionKeyForMeB64 = prepared.sessionKeyForRecipientB64,
                identityPrivateKey = recipientIdentity.private,
                onSessionKeyStored = {},
            )

        assertEquals(plaintext, decrypted)
    }

    @Test
    fun decryptMessage_partnerPath_ignoresLocalOutboundSessionKey() {
        val senderSession = GafChatE2eeCrypto.randomSessionKeyBytes()
        val recipientIdentity = GafChatE2eeCrypto.generateIdentityKeyPair()
        val recipientPem = GafChatE2eeCrypto.publicKeyToPem(recipientIdentity.public)
        val plaintext = "partner message"

        val prepared =
            GafChatE2eeCrypto.prepareMessage(
                plaintext = plaintext,
                sessionKeyBytes = senderSession,
                partnerPublicKeyPem = recipientPem,
            )

        val decrypted =
            GafChatE2eeCrypto.decryptMessage(
                ciphertextB64 = prepared.ciphertextB64,
                nonceB64 = prepared.nonceB64,
                sessionKeyBytes = null,
                encryptedSessionKeyForMeB64 = prepared.sessionKeyForRecipientB64,
                identityPrivateKey = recipientIdentity.private,
                onSessionKeyStored = {},
            )

        assertEquals(plaintext, decrypted)
    }

    @Test
    fun prepareAndDecrypt_roundTrip_withExistingSessionKey() {
        val sessionKey = GafChatE2eeCrypto.randomSessionKeyBytes()
        val prepared =
            GafChatE2eeCrypto.prepareMessage(
                plaintext = "hello",
                sessionKeyBytes = sessionKey,
                partnerPublicKeyPem = null,
            )
        val decrypted =
            GafChatE2eeCrypto.decryptMessage(
                ciphertextB64 = prepared.ciphertextB64,
                nonceB64 = prepared.nonceB64,
                sessionKeyBytes = sessionKey,
                encryptedSessionKeyForMeB64 = null,
                identityPrivateKey = null,
                onSessionKeyStored = {},
            )
        assertEquals("hello", decrypted)
    }
}
