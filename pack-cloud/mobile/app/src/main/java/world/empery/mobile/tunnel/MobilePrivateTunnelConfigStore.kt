/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Encrypted persistence for the operator-provisioned WireGuard peer config used by the mobile private tunnel beta.
 *
 * Invariants:
 * - Peer configs include private keys and must never be stored in plaintext preferences.
 * - UI-facing metadata is redacted; raw config is returned only to the tunnel backend.
 *
 * Related:
 * - MobilePrivateTunnelManager, documentation/product/mobile/MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.wireguard.config.Config
import java.io.FileNotFoundException
import java.io.IOException
import java.security.GeneralSecurityException

data class MobilePrivateTunnelConfigSummary(
    val peerAddress: String? = null,
    val endpoint: String? = null,
    val dns: String? = null,
)

class MobilePrivateTunnelConfigStore(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences? = openEncryptedPreferences(appContext)
    private val bundledConfig: String? = readBundledConfig()

    fun readConfig(): String? =
        safeRead { sp ->
            sp.getString(KEY_CONFIG, null)?.trim()?.takeIf { it.isNotBlank() }
        }?.let { sanitizeConfig(it, "stored") }
            ?: bundledConfig

    fun hasConfig(): Boolean = readConfig() != null

    fun saveConfig(rawConfig: String): MobilePrivateTunnelConfigSummary {
        val normalized = normalizeConfig(rawConfig)
        validateConfig(normalized)
        safeWrite { sp -> sp.edit().putString(KEY_CONFIG, normalized).commit() }
        return summarize(normalized)
    }

    fun clear() {
        safeWrite { sp -> sp.edit().remove(KEY_CONFIG).commit() }
    }

    fun summary(): MobilePrivateTunnelConfigSummary? = readConfig()?.let(::summarize)

    fun readPeerPublicKey(): String? = readConfig()?.let(Companion::parsePeerPublicKeyFromConfig)

    private inline fun <T> safeRead(block: (SharedPreferences) -> T?): T? {
        val sp = prefs ?: return null
        return try {
            block(sp)
        } catch (_: ClassCastException) {
            Log.w(TAG, "Private tunnel config read failed: incompatible encrypted prefs")
            null
        } catch (_: SecurityException) {
            Log.w(TAG, "Private tunnel config read denied")
            null
        }
    }

    private inline fun safeWrite(crossinline block: (SharedPreferences) -> Boolean) {
        val sp = prefs ?: throw IllegalStateException("Encrypted tunnel config store is unavailable")
        try {
            if (!block(sp)) {
                throw IllegalStateException("Tunnel config persistence commit returned false")
            }
        } catch (err: SecurityException) {
            throw IllegalStateException("Tunnel config write denied", err)
        }
    }

    private fun normalizeConfig(rawConfig: String): String =
        rawConfig
            .lineSequence()
            .map { it.trimEnd() }
            .dropWhile { it.isBlank() }
            .joinToString("\n")
            .trim()

    private fun validateConfig(config: String) {
        require(config.contains("[Interface]")) { "WireGuard config must include [Interface]" }
        require(config.contains("[Peer]")) { "WireGuard config must include [Peer]" }
        require(config.lineSequence().any { it.trim().startsWith("PrivateKey =") }) {
            "WireGuard config must include Interface PrivateKey"
        }
        require(config.lineSequence().any { it.trim().startsWith("PublicKey =") }) {
            "WireGuard config must include Peer PublicKey"
        }
        require(config.lineSequence().any { it.trim().startsWith("Endpoint =") }) {
            "WireGuard config must include Peer Endpoint"
        }
        Config.parse(config.byteInputStream())
    }

    private fun sanitizeConfig(config: String, source: String): String? {
        val normalized = normalizeConfig(config)
        if (normalized.isBlank()) return null
        return try {
            validateConfig(normalized)
            normalized
        } catch (_: Exception) {
            Log.w(TAG, "Private tunnel $source config is invalid")
            null
        }
    }

    private fun readBundledConfig(): String? =
        try {
            appContext.assets.open(BUNDLED_CONFIG_ASSET).bufferedReader().use { reader ->
                sanitizeConfig(reader.readText(), "bundled")
            }
        } catch (_: FileNotFoundException) {
            null
        } catch (err: IOException) {
            Log.w(TAG, "Private tunnel bundled config read failed", err)
            null
        }

    private fun summarize(config: String): MobilePrivateTunnelConfigSummary {
        fun firstValue(key: String): String? =
            config.lineSequence()
                .map { it.trim() }
                .firstOrNull { it.startsWith("$key =") }
                ?.substringAfter('=')
                ?.trim()
                ?.takeIf { it.isNotBlank() }

        return MobilePrivateTunnelConfigSummary(
            peerAddress = firstValue("Address"),
            endpoint = firstValue("Endpoint"),
            dns = firstValue("DNS"),
        )
    }

    companion object {
        private const val TAG = "MobilePrivateTunnelConfigStore"
        private const val PREFS_NAME = "mobile_private_tunnel_config"
        private const val KEY_CONFIG = "wireguard_peer_config"
        private const val BUNDLED_CONFIG_ASSET = "mobile_private_tunnel_default.conf"

        internal fun parsePeerPublicKeyFromConfig(config: String): String? {
            var inPeerSection = false
            for (rawLine in config.lineSequence()) {
                val line = rawLine.trim()
                when {
                    line == "[Peer]" -> inPeerSection = true
                    line.startsWith("[") && line.endsWith("]") && line != "[Peer]" -> inPeerSection = false
                    inPeerSection && line.startsWith("PublicKey =") ->
                        return line.substringAfter('=').trim().takeIf { it.isNotBlank() }
                }
            }
            return null
        }

        private fun openEncryptedPreferences(context: Context): SharedPreferences? {
            return try {
                createEncryptedPrefs(context, PREFS_NAME)
            } catch (e: GeneralSecurityException) {
                Log.e(TAG, "Encrypted tunnel prefs unavailable", e)
                null
            } catch (e: IOException) {
                Log.e(TAG, "Encrypted tunnel prefs IO error", e)
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
