/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable anonymous device identifier for FCM, push tokens, and trusted-device binding.
 *
 * Invariants:
 * - UUID persists across app restarts; falls back to plain SharedPreferences when encrypted prefs fail.
 * - No hardware identifiers.
 *
 * Related:
 * - MobileApp.syncFcmTokenToBackend, MobileTrustedDeviceKeyStore
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.io.IOException
import java.security.GeneralSecurityException
import java.util.UUID

class SecureDeviceIdStore(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val encryptedPrefs: SharedPreferences? = openEncryptedPreferences(appContext)
    private val fallbackPrefs: SharedPreferences =
        appContext.getSharedPreferences(FALLBACK_PREFS_NAME, Context.MODE_PRIVATE)

    fun getOrCreate(): String {
        readPersistedId()?.let { existing ->
            persistId(existing)
            return existing
        }
        val created = UUID.randomUUID().toString()
        persistId(created)
        return created
    }

    private fun readPersistedId(): String? {
        val fromEncrypted = readId(encryptedPrefs)
        val fromFallback = readId(fallbackPrefs)
        return fromEncrypted ?: fromFallback
    }

    private fun readId(prefs: SharedPreferences?): String? {
        if (prefs == null) return null
        return try {
            prefs.getString(KEY_DEVICE_ID, null)?.trim()?.takeIf { it.isNotBlank() }
        } catch (_: SecurityException) {
            Log.w(TAG, "Device id read denied")
            null
        }
    }

    private fun persistId(id: String) {
        var persisted = false
        for (prefs in listOfNotNull(encryptedPrefs, fallbackPrefs)) {
            try {
                if (prefs.edit().putString(KEY_DEVICE_ID, id).commit()) {
                    persisted = true
                }
            } catch (_: SecurityException) {
                Log.w(TAG, "Device id write denied")
            }
        }
        if (!persisted) {
            Log.w(TAG, "Device id persistence failed for all stores")
        }
    }

    companion object {
        private const val TAG = "SecureDeviceIdStore"
        private const val ENCRYPTED_PREFS_NAME = "mobile_secure_device_id"
        private const val FALLBACK_PREFS_NAME = "mobile_secure_device_id_fallback"
        private const val KEY_DEVICE_ID = "device_id"

        private fun openEncryptedPreferences(context: Context): SharedPreferences? {
            return try {
                createEncryptedPrefs(context, ENCRYPTED_PREFS_NAME)
            } catch (e: GeneralSecurityException) {
                Log.w(TAG, "Encrypted device prefs unavailable", e)
                null
            } catch (e: IOException) {
                Log.w(TAG, "Encrypted device prefs IO error", e)
                null
            }
        }

        @Throws(GeneralSecurityException::class, IOException::class)
        private fun createEncryptedPrefs(context: Context, name: String): SharedPreferences {
            val masterKey =
                MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
            return EncryptedSharedPreferences.create(
                context,
                name,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
