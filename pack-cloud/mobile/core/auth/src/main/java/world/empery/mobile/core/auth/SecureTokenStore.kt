/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Encrypted OAuth token persistence for mobile SSO sessions.
 *
 * Invariants:
 * - EncryptedSharedPreferences only on real devices; no plaintext disk and no process-local RAM session fallback.
 * - Init failure after recovery → [SecurityStorageException] (fail-closed).
 * - Persist failure → [SecurityStorageException] so AuthRepository can force logout.
 * - Robolectric JVM unit tests use MODE_PRIVATE prefs (no Keystore) — never a phantom RAM session.
 *
 * Related:
 * - AuthRepository, BearerTokenInterceptor, ProactiveTokenRefreshInterceptor, SecurityStorageException
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.io.IOException
import java.security.GeneralSecurityException
import java.util.Locale
import world.empery.mobile.core.network.AccessTokenProvider
import world.empery.mobile.core.network.TokenExpiryProvider

data class TokenBundle(
    val accessToken: String,
    val refreshToken: String,
    val expiresAtEpochSeconds: Long,
)

/**
 * Persists OAuth tokens with EncryptedSharedPreferences (AES-SIV keys + AES-GCM values).
 *
 * Failure modes:
 * - If the keystore or encrypted prefs cannot be opened after delete-and-recreate recovery,
 *   construction throws [SecurityStorageException] (no ghost in-memory session).
 * - After successful recovery recreate, the store is empty — caller must treat as logged out.
 * - Persist commit failure throws [SecurityStorageException] for AuthRepository force-logout.
 */
class SecureTokenStore private constructor(
    private val prefs: SharedPreferences,
    recoveredEmptyAfterCorruption: Boolean,
) : AccessTokenProvider, TokenExpiryProvider {
    constructor(context: Context) : this(
        prefs =
            openEncryptedPreferences(context.applicationContext)
                ?: throw SecurityStorageException(
                    "EncryptedSharedPreferences unavailable after recovery; refuse phantom session",
                ),
        recoveredEmptyAfterCorruption = consumeRecoveredEmptyFlag(),
    )

    /**
     * Test / harness constructor — injects an explicit [SharedPreferences] backend.
     * Production code must use [SecureTokenStore] with a [Context].
     */
    internal constructor(prefs: SharedPreferences) : this(prefs, recoveredEmptyAfterCorruption = false)

    /**
     * True when this process opened storage only after deleting a corrupt prefs file
     * (previous tokens intentionally discarded — force re-login).
     */
    val recoveredEmptyAfterCorruption: Boolean = recoveredEmptyAfterCorruption

    override fun accessToken(): String? =
        safeRead { it.getString(KEY_ACCESS_TOKEN, null) }

    fun refreshToken(): String? =
        safeRead { it.getString(KEY_REFRESH_TOKEN, null) }

    override fun expiresAtEpochSeconds(): Long? =
        safeRead {
            val value = it.getLong(KEY_EXPIRES_AT, 0L)
            value.takeIf { epoch -> epoch > 0L }
        }

    fun save(bundle: TokenBundle) {
        val wrote =
            try {
                prefs.edit()
                    .putString(KEY_ACCESS_TOKEN, bundle.accessToken)
                    .putString(KEY_REFRESH_TOKEN, bundle.refreshToken)
                    .putLong(KEY_EXPIRES_AT, bundle.expiresAtEpochSeconds)
                    .commit()
            } catch (e: SecurityException) {
                throw SecurityStorageException("Token write denied by secure storage", e)
            }
        if (!wrote) {
            throw SecurityStorageException("Token persistence commit returned false")
        }
    }

    fun clear() {
        try {
            prefs.edit().clear().commit()
        } catch (e: SecurityException) {
            Log.w(TAG, "Token clear denied", e)
            throw SecurityStorageException("Token clear denied by secure storage", e)
        }
    }

    private inline fun <T> safeRead(block: (SharedPreferences) -> T?): T? {
        return try {
            block(prefs)
        } catch (_: ClassCastException) {
            Log.w(TAG, "Token read failed: corrupt or incompatible encrypted prefs")
            null
        } catch (_: SecurityException) {
            Log.w(TAG, "Token read denied")
            null
        }
    }

    companion object {
        private const val TAG = "SecureTokenStore"
        private const val PREFS_NAME = "mobile_secure_tokens"
        private const val PREFS_NAME_ROBOLECTRIC = "mobile_secure_tokens_robolectric"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"

        @Volatile
        private var recoveredEmptyFlag: Boolean = false

        private fun consumeRecoveredEmptyFlag(): Boolean {
            val value = recoveredEmptyFlag
            recoveredEmptyFlag = false
            return value
        }

        /**
         * Robolectric has no Android Keystore; EncryptedSharedPreferences always fails there.
         * Use a named MODE_PRIVATE prefs file for JVM unit tests only — never a process-RAM
         * phantom session, and never on real device/emulator fingerprints.
         */
        private fun isRobolectricRuntime(): Boolean =
            Build.FINGERPRINT.lowercase(Locale.US).contains("robolectric")

        private fun openEncryptedPreferences(context: Context): SharedPreferences? {
            if (isRobolectricRuntime()) {
                Log.w(TAG, "Robolectric runtime: using MODE_PRIVATE prefs (no Keystore)")
                return context.getSharedPreferences(PREFS_NAME_ROBOLECTRIC, Context.MODE_PRIVATE)
            }
            return try {
                createEncryptedPrefs(context, PREFS_NAME)
            } catch (e: GeneralSecurityException) {
                Log.w(TAG, "Encrypted prefs unavailable, attempting migration recovery", e)
                recoverOrFail(context)
            } catch (e: IOException) {
                Log.w(TAG, "Encrypted prefs IO error, attempting migration recovery", e)
                recoverOrFail(context)
            }
        }

        private fun recoverOrFail(context: Context): SharedPreferences? {
            val recovered = recoverByDeleteAndRecreate(context, PREFS_NAME)
            if (recovered == null) {
                Log.e(TAG, "CRITICAL: EncryptedSharedPreferences unavailable; fail-closed (no RAM session)")
            } else {
                recoveredEmptyFlag = true
                Log.w(TAG, "Encrypted prefs recreated empty after corruption; force re-login required")
            }
            return recovered
        }

        /**
         * Removes a corrupt or unreadable encrypted prefs store and opens a fresh one.
         * Does not expose previous values in plaintext.
         */
        private fun recoverByDeleteAndRecreate(context: Context, name: String): SharedPreferences? {
            if (!context.deleteSharedPreferences(name)) {
                Log.e(TAG, "Could not delete encrypted prefs for recovery")
                return null
            }
            return try {
                createEncryptedPrefs(context, name)
            } catch (e: GeneralSecurityException) {
                Log.e(TAG, "Encrypted prefs recovery failed after delete", e)
                null
            } catch (e: IOException) {
                Log.e(TAG, "Encrypted prefs recovery failed after delete", e)
                null
            }
        }

        @Throws(GeneralSecurityException::class, IOException::class)
        private fun createEncryptedPrefs(context: Context, name: String): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
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
