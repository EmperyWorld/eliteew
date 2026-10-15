/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local policy for validating mobile UGS song topics before generation requests leave the app.
 *
 * Invariants:
 * - Client-side checks are UX guards; backend moderation remains the trust boundary.
 * - Obvious profanity obfuscation must be compacted before stem matching.
 *
 * Related:
 * - UgsSongsScreen.kt, UgsSongTopicPolicyTest.kt, documentation/product/mobile/MOBILE-ANDROID-GUIDELINES.md
 */
package feature.ugs

enum class UgsSongTopicRejectReason {
    EMPTY,
    PROFANITY_OR_OBFUSCATION,
    PROHIBITED_CONTENT,
}

data class UgsSongTopicValidation(
    val normalizedTopic: String,
    val rejectReason: UgsSongTopicRejectReason? = null,
) {
    val isValid: Boolean get() = rejectReason == null
}

private val LATIN_TO_CYRILLIC =
    mapOf(
        'a' to 'а',
        'b' to 'б',
        'c' to 'с',
        'e' to 'е',
        'h' to 'н',
        'k' to 'к',
        'm' to 'м',
        'o' to 'о',
        'p' to 'р',
        'r' to 'р',
        't' to 'т',
        'u' to 'у',
        'x' to 'х',
        'y' to 'у',
    )

private val LEET_TO_CYRILLIC =
    mapOf(
        '0' to 'о',
        '1' to 'и',
        '3' to 'е',
        '4' to 'ч',
        '6' to 'б',
        '7' to 'т',
        '@' to 'а',
        '$' to 'с',
    )

private val PROFANITY_STEMS =
    listOf(
        "бля",
        "бляд",
        "выеб",
        "долбоеб",
        "заеб",
        "наеб",
        "поеб",
        "уеб",
        "ебат",
        "ебаш",
        "ебл",
        "ебн",
        "ебт",
        "ебуч",
        "ебан",
        "пизд",
        "пзд",
        "хуй",
        "хуе",
        "хуя",
        "хуи",
        "сука",
        "манда",
        "гандон",
    )

private val PROHIBITED_PATTERNS =
    listOf(
        "наркот",
        "кокаин",
        "героин",
        "мефедрон",
        "убий",
        "суицид",
        "самоуб",
        "террор",
        "экстрем",
        "взрывчат",
        "бомб",
        "оруж",
        "педоф",
        "изнасил",
    )

fun validateUgsSongTopic(rawTopic: String): UgsSongTopicValidation {
    val displayTopic = rawTopic.trim()
    if (displayTopic.isBlank()) {
        return UgsSongTopicValidation(displayTopic, UgsSongTopicRejectReason.EMPTY)
    }

    val compact = compactPolicyText(displayTopic)
    if (PROFANITY_STEMS.any { compact.contains(it) }) {
        return UgsSongTopicValidation(displayTopic, UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION)
    }
    if (PROHIBITED_PATTERNS.any { compact.contains(it) }) {
        return UgsSongTopicValidation(displayTopic, UgsSongTopicRejectReason.PROHIBITED_CONTENT)
    }

    return UgsSongTopicValidation(displayTopic)
}

internal fun compactPolicyText(rawText: String): String =
    rawText
        .lowercase()
        .mapNotNull { ch ->
            when {
                ch == 'ё' -> 'е'
                ch in LATIN_TO_CYRILLIC -> LATIN_TO_CYRILLIC[ch]
                ch in LEET_TO_CYRILLIC -> LEET_TO_CYRILLIC[ch]
                ch.isLetterOrDigit() -> ch
                else -> null
            }
        }
        .joinToString("")
