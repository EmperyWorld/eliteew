/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonicalize native OAuth redirect URIs so AppAuth and Keycloak see the same string.
 *
 * Invariants:
 * - Host-form `scheme://oauth2redirect` is the wire form sent to Keycloak.
 * - Path-form `scheme:/oauth2redirect` remains accepted as config/input alias.
 * - Canonicalize uses pure string parsing (JVM-safe); Uri helpers are for callback matching only.
 *
 * Related:
 * - OidcAuthManager, keycloak-harden-empery-realm.sh, KEYCLOAK-ELITEEW.md
 */
package world.empery.mobile.core.auth

import android.net.Uri

object MobileOAuthRedirectUris {
    private const val CALLBACK_PATH = "oauth2redirect"

    /**
     * Normalize BuildConfig / env redirect strings to the host-form AppAuth serializes
     * (`scheme://oauth2redirect`). Android [Uri.parse] of `scheme:/path` often becomes
     * hierarchical host-form; Keycloak Valid redirect URIs must match the wire string exactly.
     */
    fun canonicalize(raw: String): String {
        val trimmed = raw.trim()
        require(trimmed.isNotEmpty()) { "redirect URI must not be blank" }
        val schemeSep = trimmed.indexOf(':')
        require(schemeSep > 0) { "redirect URI must include a scheme" }
        val scheme = trimmed.substring(0, schemeSep).trim()
        require(scheme.isNotEmpty()) { "redirect URI scheme required" }
        val afterScheme = trimmed.substring(schemeSep + 1).trimStart('/')
        val pathKey =
            afterScheme
                .substringBefore('?')
                .substringBefore('#')
                .trimEnd('/')
                .ifEmpty { CALLBACK_PATH }
        return "$scheme://$pathKey"
    }

    fun toAppAuthUri(raw: String): Uri = Uri.parse(canonicalize(raw))

    fun pathKey(uri: Uri): String {
        val path = uri.path?.trim('/')?.takeIf { it.isNotEmpty() }
        if (path != null) return path
        val host = uri.host?.trim()?.takeIf { it.isNotEmpty() }
        if (host != null) return host
        val ssp = uri.schemeSpecificPart ?: return ""
        return ssp
            .substringBefore('?')
            .substringBefore('#')
            .trimStart('/')
            .trimEnd('/')
    }

    /** Both forms Keycloak should accept for one flavor (new APK + older path-form installs). */
    fun keycloakRegistrationVariants(canonicalOrConfig: String): List<String> {
        val canonical = canonicalize(canonicalOrConfig)
        val schemeSep = canonical.indexOf(':')
        val scheme = canonical.substring(0, schemeSep)
        val key =
            canonical
                .substring(schemeSep + 1)
                .trimStart('/')
                .substringBefore('?')
                .substringBefore('#')
                .trimEnd('/')
                .ifEmpty { CALLBACK_PATH }
        val pathForm = "$scheme:/$key"
        return listOf(canonical, pathForm).distinct()
    }
}
