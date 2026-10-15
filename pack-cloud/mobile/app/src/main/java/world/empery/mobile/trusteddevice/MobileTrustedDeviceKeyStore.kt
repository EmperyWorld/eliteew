/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Android-local trusted-device key foundation: device identity signing key, WireGuard keypair persistence, and GAF E2EE seed preparation.
 *
 * Invariants:
 * - Device identity private key is generated inside Android Keystore and never exported.
 * - WireGuard private key and GAF seed stay in encrypted local app storage and are never logged.
 * - Binding is blocked when Android has no secure screen lock configured.
 * - clearEphemeralBindingMaterial uses SharedPreferences.commit() (restart-safe).
 *
 * Related:
 * - documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
 * - shared/api/routers/mobile_trusted_devices.py
 */
package world.empery.mobile.trusteddevice

import android.app.KeyguardManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.wireguard.crypto.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import world.empery.mobile.core.auth.SecureDeviceIdStore

data class MobileTrustedDeviceCapability(
    val screenLockConfigured: Boolean,
    val deviceIdentityKeyPresent: Boolean,
    val wireGuardKeyPresent: Boolean,
    val gafKeyPresent: Boolean,
)

data class MobileTrustedDeviceBindMaterial(
    val stableDeviceId: String,
    val devicePublicKeyAlgorithm: String,
    val devicePublicKey: String,
    val signedChallenge: String,
    val wgPublicKey: String,
    val gafPublicKey: String?,
    val gafPublicKeyAlgorithm: String?,
    val capabilities: Map<String, Any>,
)

data class MobileTrustedDeviceTunnelMetadata(
    val interfaceAddress: String,
    val dns: String,
    val allowedIps: String,
    val endpoint: String,
    val serverPublicKey: String,
    val persistentKeepalive: Int = 25,
    val mtu: Int = 1280,
)

data class PendingWireGuardKeyPair(
    val privateKey: String,
    val publicKey: String,
)

data class TrustedDeviceBindingSnapshot(
    val activeDeviceId: String,
    val deviceLabel: String,
)

class MobileTrustedDeviceKeyStore(
    context: Context,
    private val secureDeviceIdStore: SecureDeviceIdStore = SecureDeviceIdStore(context),
) {
    private val appContext = context.applicationContext
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    private val prefs: SharedPreferences by lazy { createEncryptedPrefs(appContext) }

    fun capability(): MobileTrustedDeviceCapability =
        MobileTrustedDeviceCapability(
            screenLockConfigured = isScreenLockConfigured(),
            deviceIdentityKeyPresent = keyStore.containsAlias(DEVICE_IDENTITY_ALIAS),
            wireGuardKeyPresent = prefs.contains(KEY_WG_PRIVATE) && prefs.contains(KEY_WG_PUBLIC),
            gafKeyPresent = prefs.contains(KEY_GAF_PRIVATE) && prefs.contains(KEY_GAF_PUBLIC),
        )

    fun currentStableDeviceId(): String = secureDeviceIdStore.getOrCreate()

    /** Drops WG/GAF material imported during bind; keeps Android Keystore device identity. */
    fun clearEphemeralBindingMaterial() {
        // commit(): callers often restart the process immediately; apply() can lose the clear.
        prefs.edit()
            .remove(KEY_WG_PRIVATE)
            .remove(KEY_WG_PUBLIC)
            .remove(KEY_GAF_PRIVATE)
            .remove(KEY_GAF_PUBLIC)
            .remove(KEY_BOUND_ACTIVE_DEVICE_ID)
            .remove(KEY_BOUND_DEVICE_LABEL)
            .commit()
    }

    fun saveBindingSnapshot(
        activeDeviceId: String,
        deviceLabel: String,
    ) {
        val id = activeDeviceId.trim()
        val label = deviceLabel.trim()
        if (id.isEmpty()) return
        prefs.edit()
            .putString(KEY_BOUND_ACTIVE_DEVICE_ID, id)
            .putString(KEY_BOUND_DEVICE_LABEL, label.ifBlank { "Android device" })
            .apply()
    }

    fun readBindingSnapshot(): TrustedDeviceBindingSnapshot? {
        val id = prefs.getString(KEY_BOUND_ACTIVE_DEVICE_ID, null)?.trim().orEmpty()
        if (id.isEmpty()) return null
        val label = prefs.getString(KEY_BOUND_DEVICE_LABEL, null)?.trim().orEmpty()
        return TrustedDeviceBindingSnapshot(
            activeDeviceId = id,
            deviceLabel = label.ifBlank { "Android device" },
        )
    }

    fun buildBindMaterial(
        challengeNonce: String,
        prepareGafE2ee: Boolean,
    ): MobileTrustedDeviceBindMaterial {
        require(isScreenLockConfigured()) {
            "Android screen lock is required for trusted-device binding"
        }
        ensureDeviceIdentityKey()
        val wgPublicKey = getOrCreateWireGuardPublicKey()
        val gafPublicKey = if (prepareGafE2ee) getOrCreateGafPublicKey() else null
        return MobileTrustedDeviceBindMaterial(
            stableDeviceId = secureDeviceIdStore.getOrCreate(),
            devicePublicKeyAlgorithm = DEVICE_PUBLIC_KEY_ALGORITHM,
            devicePublicKey = deviceIdentityPublicKey(),
            signedChallenge = signChallenge(challengeNonce),
            wgPublicKey = wgPublicKey,
            gafPublicKey = gafPublicKey,
            gafPublicKeyAlgorithm = if (gafPublicKey != null) GAF_PUBLIC_KEY_ALGORITHM else null,
            capabilities = mapOf(
                "screen_lock" to true,
                "device_identity_algorithm" to DEVICE_PUBLIC_KEY_ALGORITHM,
                "wireguard_local_private_key" to true,
                "gaf_key_algorithm" to (if (gafPublicKey != null) GAF_PUBLIC_KEY_ALGORITHM else "none"),
                "android_sdk" to Build.VERSION.SDK_INT,
            ),
        )
    }

    fun buildWireGuardConfig(metadata: MobileTrustedDeviceTunnelMetadata): String {
        val privateKey = prefs.getString(KEY_WG_PRIVATE, null)?.trim().orEmpty()
        require(privateKey.isNotEmpty()) { "WireGuard private key is not generated" }
        return buildWireGuardConfig(privateKey, metadata)
    }

    /** Generate a new WG keypair without replacing the committed keys until [commitWireGuardKeyPair]. */
    fun generateWireGuardKeyPairForRotation(): PendingWireGuardKeyPair {
        val pair = KeyPair()
        return PendingWireGuardKeyPair(
            privateKey = pair.privateKey.toBase64(),
            publicKey = pair.publicKey.toBase64(),
        )
    }

    fun commitWireGuardKeyPair(pending: PendingWireGuardKeyPair) {
        val privateKey = pending.privateKey.trim()
        val publicKey = pending.publicKey.trim()
        require(privateKey.isNotEmpty() && publicKey.isNotEmpty()) {
            "WireGuard keypair for rotation is empty"
        }
        prefs.edit()
            .putString(KEY_WG_PRIVATE, privateKey)
            .putString(KEY_WG_PUBLIC, publicKey)
            .apply()
    }

    fun signTransferMessage(message: String): String {
        require(isScreenLockConfigured()) {
            "Android screen lock is required for trusted-device transfer"
        }
        ensureDeviceIdentityKey()
        return signChallenge(message)
    }

    private fun isScreenLockConfigured(): Boolean {
        val keyguard = appContext.getSystemService(KeyguardManager::class.java)
        return keyguard?.isDeviceSecure == true
    }

    private fun ensureDeviceIdentityKey() {
        if (keyStore.containsAlias(DEVICE_IDENTITY_ALIAS)) return
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        val builder = KeyGenParameterSpec.Builder(
            DEVICE_IDENTITY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                USER_AUTH_VALIDITY_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL,
            )
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(USER_AUTH_VALIDITY_SECONDS)
        }
        generator.initialize(builder.build())
        generator.generateKeyPair()
    }

    private fun deviceIdentityPublicKey(): String {
        val cert = keyStore.getCertificate(DEVICE_IDENTITY_ALIAS)
            ?: error("Device identity key is not generated")
        return base64(cert.publicKey.encoded)
    }

    private fun signChallenge(challengeNonce: String): String {
        val entry = keyStore.getEntry(DEVICE_IDENTITY_ALIAS, null) as? KeyStore.PrivateKeyEntry
            ?: error("Device identity key is not generated")
        return try {
            val signer = Signature.getInstance("SHA256withECDSA")
            signer.initSign(entry.privateKey)
            signer.update(challengeNonce.toByteArray(Charsets.UTF_8))
            base64(signer.sign())
        } catch (e: UserNotAuthenticatedException) {
            throw SecurityException("Device credential or biometric authentication is required", e)
        }
    }

    private fun getOrCreateWireGuardPublicKey(): String {
        val existingPublic = prefs.getString(KEY_WG_PUBLIC, null)?.trim()
        val existingPrivate = prefs.getString(KEY_WG_PRIVATE, null)?.trim()
        if (!existingPublic.isNullOrBlank() && !existingPrivate.isNullOrBlank()) {
            return existingPublic
        }
        val pair = KeyPair()
        val privateKey = pair.privateKey.toBase64()
        val publicKey = pair.publicKey.toBase64()
        prefs.edit()
            .putString(KEY_WG_PRIVATE, privateKey)
            .putString(KEY_WG_PUBLIC, publicKey)
            .apply()
        return publicKey
    }

    private fun getOrCreateGafPublicKey(): String {
        val existing = prefs.getString(KEY_GAF_PUBLIC, null)?.trim()
        if (!existing.isNullOrBlank() && prefs.contains(KEY_GAF_PRIVATE)) return existing
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val pair = generator.generateKeyPair()
        prefs.edit()
            .putString(KEY_GAF_PRIVATE, base64(pair.private.encoded))
            .putString(KEY_GAF_PUBLIC, base64(pair.public.encoded))
            .apply()
        return base64(pair.public.encoded)
    }

    companion object {
        const val DEVICE_PUBLIC_KEY_ALGORITHM = "p256-es256"
        const val GAF_PUBLIC_KEY_ALGORITHM = "p256-ecdh"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val DEVICE_IDENTITY_ALIAS = "eliteew_mobile_trusted_device_identity_v1"
        private const val PREFS_NAME = "eliteew_mobile_trusted_device_keys_v1"
        private const val KEY_WG_PRIVATE = "wg_private_key"
        private const val KEY_WG_PUBLIC = "wg_public_key"
        private const val KEY_GAF_PRIVATE = "gaf_private_key_v1"
        private const val KEY_GAF_PUBLIC = "gaf_public_key_v1"
        private const val KEY_BOUND_ACTIVE_DEVICE_ID = "bound_active_device_id_v1"
        private const val KEY_BOUND_DEVICE_LABEL = "bound_device_label_v1"
        private const val USER_AUTH_VALIDITY_SECONDS = 60

        fun buildWireGuardConfig(
            privateKey: String,
            metadata: MobileTrustedDeviceTunnelMetadata,
        ): String =
            """
            [Interface]
            PrivateKey = ${privateKey.trim()}
            Address = ${metadata.interfaceAddress.trim()}
            DNS = ${metadata.dns.trim()}
            MTU = ${metadata.mtu.coerceIn(576, 1500)}

            [Peer]
            PublicKey = ${metadata.serverPublicKey.trim()}
            Endpoint = ${metadata.endpoint.trim()}
            AllowedIPs = ${metadata.allowedIps.trim()}
            PersistentKeepalive = ${metadata.persistentKeepalive}
            """.trimIndent()

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

        private fun base64(raw: ByteArray): String =
            Base64.getEncoder().encodeToString(raw)

    }
}
