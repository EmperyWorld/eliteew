/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat E2EE wire crypto (RSA-OAEP SHA-256 identity + AES-GCM payloads) matching desktop GAFChatCrypto.ts.
 *
 * Invariants:
 * - Algorithm labels and wire shapes stay aligned with EliteEW/web GAFChatCrypto.ts.
 * - Decrypt failures return null; callers map to user-facing placeholder text.
 *
 * Related:
 * - GafChatE2eeKeyStore.kt, GafChatE2eeCoordinator.kt, documentation/product/GAF-CHAT-BACKEND.md
 */
package feature.chat

import android.util.Base64
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

object GafChatE2eeAlgorithms {
    const val IDENTITY = "rsa_oaep_sha256"
    const val PAYLOAD = "e2e_aes_gcm"
    const val VERSION = "e2e_v1"
}

data class GafPreparedE2eeMessage(
    val ciphertextB64: String,
    val nonceB64: String,
    val algorithm: String,
    val encryptionVersion: String,
    val sessionKeyForRecipientB64: String?,
    val sessionKeyForSelfB64: String? = null,
)

object GafChatE2eeCrypto {
    private const val RSA_BITS = 2048
    private const val RSA_OAEP_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
    private const val AES_GCM_TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val GCM_IV_BYTES = 12
    private const val SESSION_KEY_BYTES = 32

    private val rsaOaepSpec =
        OAEPParameterSpec(
            "SHA-256",
            "MGF1",
            MGF1ParameterSpec.SHA256,
            PSource.PSpecified.DEFAULT,
        )

    fun generateIdentityKeyPair(): KeyPair {
        val generator = KeyPairGenerator.getInstance("RSA")
        generator.initialize(RSA_BITS)
        return generator.generateKeyPair()
    }

    fun publicKeyToPem(publicKey: PublicKey): String {
        val encoded = Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
        val body = encoded.chunked(64).joinToString("\n")
        return "-----BEGIN PUBLIC KEY-----\n$body\n-----END PUBLIC KEY-----"
    }

    fun pemToPublicKey(pem: String): PublicKey {
        val body =
            pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replace("\\s".toRegex(), "")
        val bytes = Base64.decode(body, Base64.DEFAULT)
        val spec = X509EncodedKeySpec(bytes)
        return KeyFactory.getInstance("RSA").generatePublic(spec)
    }

    fun privateKeyToPkcs8Base64(privateKey: PrivateKey): String =
        Base64.encodeToString(privateKey.encoded, Base64.NO_WRAP)

    fun pkcs8Base64ToPrivateKey(encoded: String): PrivateKey {
        val bytes = Base64.decode(encoded.trim(), Base64.DEFAULT)
        val spec = PKCS8EncodedKeySpec(bytes)
        return KeyFactory.getInstance("RSA").generatePrivate(spec)
    }

    fun publicPemFingerprint(pem: String): String {
        val normalized =
            pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replace("\\s".toRegex(), "")
        return sha256Hex(normalized.toByteArray(Charsets.UTF_8))
    }

    fun randomSessionKeyBytes(): ByteArray = ByteArray(SESSION_KEY_BYTES).also { SecureRandom().nextBytes(it) }

    fun prepareMessage(
        plaintext: String,
        sessionKeyBytes: ByteArray,
        partnerPublicKeyPem: String?,
        ownPublicKeyPem: String? = null,
    ): GafPreparedE2eeMessage {
        val (ciphertext, nonce) = encryptAesGcm(plaintext.toByteArray(Charsets.UTF_8), sessionKeyBytes)
        val sessionKeyForRecipientB64 =
            partnerPublicKeyPem?.takeIf { it.isNotBlank() }?.let { pem ->
                wrapSessionKeyForPublicPem(pem, sessionKeyBytes)
            }
        val sessionKeyForSelfB64 =
            ownPublicKeyPem?.takeIf { it.isNotBlank() }?.let { pem ->
                wrapSessionKeyForPublicPem(pem, sessionKeyBytes)
            }
        return GafPreparedE2eeMessage(
            ciphertextB64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP),
            nonceB64 = Base64.encodeToString(nonce, Base64.NO_WRAP),
            algorithm = GafChatE2eeAlgorithms.PAYLOAD,
            encryptionVersion = GafChatE2eeAlgorithms.VERSION,
            sessionKeyForRecipientB64 = sessionKeyForRecipientB64,
            sessionKeyForSelfB64 = sessionKeyForSelfB64,
        )
    }

    private fun wrapSessionKeyForPublicPem(pem: String, sessionKeyBytes: ByteArray): String {
        val publicKey = pemToPublicKey(pem)
        val cipher = Cipher.getInstance(RSA_OAEP_TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, publicKey, rsaOaepSpec)
        return Base64.encodeToString(cipher.doFinal(sessionKeyBytes), Base64.NO_WRAP)
    }

    fun decryptMessage(
        ciphertextB64: String,
        nonceB64: String?,
        sessionKeyBytes: ByteArray?,
        encryptedSessionKeyForMeB64: String?,
        identityPrivateKey: PrivateKey?,
        onSessionKeyStored: (ByteArray) -> Unit,
    ): String? {
        sessionKeyBytes?.let { local ->
            decryptWithSessionKey(ciphertextB64, nonceB64, local)?.let { return it }
        }
        if (!encryptedSessionKeyForMeB64.isNullOrBlank() && identityPrivateKey != null) {
            val unwrapped =
                runCatching {
                    val cipher = Cipher.getInstance(RSA_OAEP_TRANSFORMATION)
                    cipher.init(Cipher.DECRYPT_MODE, identityPrivateKey, rsaOaepSpec)
                    cipher.doFinal(Base64.decode(encryptedSessionKeyForMeB64.trim(), Base64.DEFAULT))
                }.getOrNull()
            unwrapped?.let { key ->
                decryptWithSessionKey(ciphertextB64, nonceB64, key)?.let { plain ->
                    onSessionKeyStored(key)
                    return plain
                }
            }
        }
        return null
    }

    private fun decryptWithSessionKey(
        ciphertextB64: String,
        nonceB64: String?,
        sessionKeyBytes: ByteArray,
    ): String? {
        if (nonceB64.isNullOrBlank()) return null
        return runCatching {
            val plainBytes = decryptAesGcm(
                Base64.decode(ciphertextB64.trim(), Base64.DEFAULT),
                Base64.decode(nonceB64.trim(), Base64.DEFAULT),
                sessionKeyBytes,
            )
            String(plainBytes, Charsets.UTF_8)
        }.getOrNull()
    }

    private fun encryptAesGcm(plaintext: ByteArray, keyBytes: ByteArray): Pair<ByteArray, ByteArray> {
        val cipher = Cipher.getInstance(AES_GCM_TRANSFORMATION)
        val key = SecretKeySpec(keyBytes, "AES")
        val nonce = ByteArray(GCM_IV_BYTES).also { SecureRandom().nextBytes(it) }
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, nonce))
        return cipher.doFinal(plaintext) to nonce
    }

    private fun decryptAesGcm(ciphertext: ByteArray, nonce: ByteArray, keyBytes: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(AES_GCM_TRANSFORMATION)
        val key = SecretKeySpec(keyBytes, "AES")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, nonce))
        return cipher.doFinal(ciphertext)
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { byte -> "%02x".format(byte) }
    }
}
