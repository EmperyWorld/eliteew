/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap i18n-003…005: pseudo-locale test helper and product-language display names (no raw UGS in UI).
 *
 * Invariants:
 * - User-visible product terms use glossary ids; internal API keys may still say "ugs".
 * - Pseudo-locale mode is for Robolectric/instrumentation only.
 *
 * Related:
 * - pack-cloud/mobile/docs/PRODUCT-LANGUAGE-GLOSSARY.md, feature/ugs strings
 */
package world.empery.mobile.core.ui

/** i18n-003: Android pseudo-locale tag for overflow/layout QA. */
const val PSEUDO_LOCALE_TAG = "en-XA"

/** i18n-005: stable product term ids — map to string resources in UI layer. */
enum class MobileProductTerm(val glossaryId: String) {
    AI_CREATION_HUB("ai_creation_hub"),
    EW_DESK("ew_desk"),
    GAF_CHAT("gaf_chat"),
    DESKTOP_HUB("desktop_hub"),
    GENERATION_STUDIO("generation_studio"),
}

fun isPseudoLocaleTag(localeTag: String?): Boolean =
    localeTag?.trim()?.equals(PSEUDO_LOCALE_TAG, ignoreCase = true) == true

/** Returns true when pseudo-locale stress is requested (shell debug flag or explicit tag). */
fun shouldApplyPseudoLocaleStress(pseudoLocaleDebugEnabled: Boolean, localeTag: String?): Boolean =
    pseudoLocaleDebugEnabled || isPseudoLocaleTag(localeTag)

/** i18n-005: reject showing raw internal acronym "UGS" in user-facing copy. */
fun containsRawUgsAcronym(text: String): Boolean {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return false
    return Regex("\\bUGS\\b", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)
}

fun sanitizeUserFacingProductCopy(text: String, replacement: String): String =
    Regex("\\bUGS\\b", RegexOption.IGNORE_CASE).replace(text, replacement)
