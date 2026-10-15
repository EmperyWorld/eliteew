/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Streaming SHA-256 verification for sideloaded mobile APK files.
 *
 * Invariants:
 * - Digest format is lowercase hex (64 chars), matching server manifest/overview.
 *
 * Related:
 * - MobileAppUpdateRepository, MobileAppUpdatePrefs
 */
package feature.profile

import java.io.File
import java.io.InputStream
import java.security.MessageDigest

object MobileAppUpdateHash {
    fun sha256Hex(file: File, bufferSize: Int = DEFAULT_BUFFER_SIZE): String {
        file.inputStream().use { input -> return sha256Hex(input, bufferSize) }
    }

    fun sha256Hex(input: InputStream, bufferSize: Int = DEFAULT_BUFFER_SIZE): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(bufferSize)
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            digest.update(buffer, 0, read)
        }
        return digest.digest().joinToString(separator = "") { byte ->
            "%02x".format(byte)
        }
    }

    fun matchesExpected(actualHex: String, expectedHex: String?): Boolean {
        val expected = expectedHex?.trim()?.lowercase().orEmpty()
        if (expected.length != 64) return true
        return actualHex.lowercase() == expected
    }
}
