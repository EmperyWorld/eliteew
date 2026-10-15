/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Encrypted local storage for GAF Chat wire identity (RSA) and per-chat AES session keys.
 *
 * Invariants:
 * - Private key material never leaves encrypted prefs except for in-process crypto.
 * - Session keys are scoped per chat id.
 *
 * Related:
 * - GafChatE2eeCrypto.kt, GafChatE2eeCoordinator.kt
 */
package feature.chat

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyPair
import java.security.PrivateKey

internal class GafChatE2eeKeyStore(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences by lazy { createEncryptedPrefs(appContext) }

    fun loadIdentityKeyPair(): KeyPair? {
        val pem = prefs.getString(KEY_IDENTITY_PUBLIC_PEM, null)?.takeIf { it.isNotBlank() } ?: return null
        val privateB64 = prefs.getString(KEY_IDENTITY_PRIVATE_PKCS8, null)?.takeIf { it.isNotBlank() } ?: return null
        return runCatching {
            val publicKey = GafChatE2eeCrypto.pemToPublicKey(pem)
            val privateKey = GafChatE2eeCrypto.pkcs8Base64ToPrivateKey(privateB64)
            KeyPair(publicKey, privateKey)
        }.getOrNull()
    }

    fun saveIdentityKeyPair(keyPair: KeyPair) {
        prefs
            .edit()
            .putString(KEY_IDENTITY_PUBLIC_PEM, GafChatE2eeCrypto.publicKeyToPem(keyPair.public))
            .putString(KEY_IDENTITY_PRIVATE_PKCS8, GafChatE2eeCrypto.privateKeyToPkcs8Base64(keyPair.private))
            .apply()
    }

    fun identityPrivateKey(): PrivateKey? = loadIdentityKeyPair()?.private

    fun uploadedPublicFingerprint(): String? =
        prefs.getString(KEY_UPLOADED_PUBLIC_FINGERPRINT, null)?.takeIf { it.isNotBlank() }

    fun markUploadedPublicFingerprint(pem: String) {
        prefs
            .edit()
            .putString(KEY_UPLOADED_PUBLIC_FINGERPRINT, GafChatE2eeCrypto.publicPemFingerprint(pem))
            .apply()
    }

    fun sessionKeyBytes(chatId: String): ByteArray? {
        val encoded = prefs.getString(sessionKeyPrefKey(chatId), null)?.takeIf { it.isNotBlank() } ?: return null
        return runCatching {
            android.util.Base64.decode(encoded, android.util.Base64.DEFAULT)
        }.getOrNull()
    }

    fun saveSessionKeyBytes(chatId: String, bytes: ByteArray) {
        prefs
            .edit()
            .putString(
                sessionKeyPrefKey(chatId),
                android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP),
            )
            .apply()
    }

    fun getOrCreateSessionKeyBytes(chatId: String): ByteArray {
        val existing = sessionKeyBytes(chatId)
        if (existing != null) return existing
        val created = GafChatE2eeCrypto.randomSessionKeyBytes()
        saveSessionKeyBytes(chatId, created)
        return created
    }

    private fun sessionKeyPrefKey(chatId: String): String {
        val safe = chatId.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(120).ifBlank { "chat" }
        return "$KEY_SESSION_PREFIX$safe"
    }

    private fun createEncryptedPrefs(context: Context): SharedPreferences {
        val masterKey =
            MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    companion object {
        private const val PREFS_NAME = "gaf_chat_e2ee_wire_keys"
        private const val KEY_IDENTITY_PUBLIC_PEM = "identity_public_pem"
        private const val KEY_IDENTITY_PRIVATE_PKCS8 = "identity_private_pkcs8_b64"
        private const val KEY_UPLOADED_PUBLIC_FINGERPRINT = "uploaded_public_fingerprint"
        private const val KEY_SESSION_PREFIX = "session_key_"
    }
}
