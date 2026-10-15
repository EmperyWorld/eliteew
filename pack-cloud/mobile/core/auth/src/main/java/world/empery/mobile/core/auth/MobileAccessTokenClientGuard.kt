/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fail-closed check that mobile SSO access tokens belong to the empery-mobile OIDC client
 * (azp), not empery-web — wrong client puts the phone on the browser SSO registry slot.
 *
 * Invariants:
 * - Parses JWT payload only (no signature verify); used on tokens already issued by our API/IdP.
 * - Missing/unreadable azp is rejected when [expectedClientId] is non-blank.
 *
 * Related:
 * - AuthRepository, MobileOidcRuntimeConfig, SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
 */
package world.empery.mobile.core.auth

import java.util.Base64

object MobileAccessTokenClientGuard {
    private val AZP_PATTERN = Regex(""""azp"\s*:\s*"([^"]+)"""")
    private val CLIENT_ID_PATTERN = Regex(""""client_id"\s*:\s*"([^"]+)"""")

    fun azpClaim(accessToken: String): String? {
        val payloadJson = decodeJwtPayloadUtf8(accessToken) ?: return null
        return AZP_PATTERN.find(payloadJson)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
            ?: CLIENT_ID_PATTERN.find(payloadJson)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun isAllowedMobileAccessToken(
        accessToken: String,
        expectedClientId: String,
    ): Boolean {
        val expected = expectedClientId.trim()
        if (expected.isEmpty()) return true
        val azp = azpClaim(accessToken) ?: return false
        return azp == expected
    }

    private fun decodeJwtPayloadUtf8(accessToken: String): String? {
        val parts = accessToken.split('.')
        if (parts.size < 2) return null
        val payload = parts[1].trim()
        if (payload.isEmpty()) return null
        return runCatching {
            String(Base64.getUrlDecoder().decode(payload), Charsets.UTF_8)
        }.getOrNull()
    }
}
