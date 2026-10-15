/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Music XL Base pipeline constants and helpers for mobile song generation POST bodies.
 *
 * Invariants:
 * - Mobile songs screen uses XL Base only (`mobileSongsUsesXlBasePipeline()`); Turbo (`v2`) is web-only.
 * - Aligned with web MusicGeneratorPage XL tab (`MUSIC_XL_SOURCE_MODE`, balanced sampler presets).
 *
 * Related:
 * - UgsSongsScreen.kt, MusicGeneratorPage.tsx, musicWizardV2Keyscale.ts, musicXlFeedbackTuning.ts
 */
package feature.ugs

/** Как `WIZARD_LLM_*` в веб-мастере «Основной». */
object WizardLlmSliders {
    const val TEMPERATURE = 0.85f
    const val CFG_SCALE = 2f
    const val TOP_P = 0.9f
}

/** Пресет «Сбалансировано» для XL Base/SFT (`MUSIC_XL_SAMPLER_PRESETS[0]`). */
object XlBaseBalancedSliders {
    const val TEMPERATURE = 0.84f
    const val CFG_SCALE = 1.95f
    const val TOP_P = 0.88f
    const val TOP_K = 0
    const val MIN_P = 0f
    /** KSampler cfg в Comfy при отключённом шаблоне; с `ksampler_use_comfy_template=true` не шлём `cfg`. */
    const val SAMPLER_CFG_V2_BASE = 2.1f
}

private val MUSIC_STYLE_BPM_KEYSCALE: Map<String, Pair<Int, String>> =
    mapOf(
        "pop" to Pair(118, "A minor"),
        "rock" to Pair(118, "E minor"),
        "electronic" to Pair(124, "F minor"),
        "ballad" to Pair(72, "Eb major"),
        "drum and bass" to Pair(174, "D minor"),
        "hip_hop" to Pair(92, "A minor"),
        "classical" to Pair(80, "C major"),
        "dubstep" to Pair(140, "A minor"),
        "luna" to Pair(118, "F# minor"),
        "rnb_classic_female" to Pair(88, "Eb major"),
        "lofi_chill" to Pair(82, "D minor"),
        "noir_cabaret" to Pair(76, "D minor"),
        "folk" to Pair(100, "G major"),
        "reggaeton" to Pair(94, "A minor"),
        "afrobeats" to Pair(102, "F# minor"),
        "phonk" to Pair(144, "D minor"),
        "hyperpop" to Pair(150, "C minor"),
        "bedroom_pop" to Pair(92, "A major"),
        "synthwave" to Pair(110, "E minor"),
        "emo_rap" to Pair(88, "F# minor"),
        "country_pop" to Pair(96, "G major"),
        "kpop" to Pair(120, "D minor"),
        "metal" to Pair(152, "E minor"),
        "indie_rock" to Pair(115, "A major"),
        "grunge" to Pair(92, "D minor"),
        "soul" to Pair(96, "F major"),
        "latin_pop" to Pair(96, "A minor"),
        "disco" to Pair(118, "F minor"),
        "amapiano" to Pair(115, "D minor"),
        "bollywood_pop" to Pair(110, "E minor"),
        "mandopop" to Pair(118, "A minor"),
        "drill" to Pair(140, "C minor"),
        "reggae" to Pair(78, "D major"),
        "baile_funk" to Pair(132, "F minor"),
        "punjabi_pop" to Pair(98, "B minor"),
        "neo_soul" to Pair(88, "Eb major"),
        "gospel_soul" to Pair(100, "G major"),
        "indie_folk_pop" to Pair(108, "D major"),
        "boogie_funk" to Pair(112, "F major"),
        "chillout" to Pair(95, "D minor"),
        "jazz" to Pair(112, "F major"),
        "chicago_blues" to Pair(104, "A minor"),
        "house" to Pair(128, "F minor"),
        "techno" to Pair(130, "A minor"),
        "trance" to Pair(138, "D minor"),
        "edm" to Pair(128, "C minor"),
        "hardstyle" to Pair(150, "E minor"),
        "ambient_instrumental" to Pair(68, "Eb major"),
        "post_rock_instrumental" to Pair(112, "D major"),
        "cinematic_instrumental" to Pair(82, "C minor"),
        "bossa_instrumental" to Pair(126, "F major"),
        "funk_instrumental" to Pair(104, "E minor"),
        "celtic_instrumental" to Pair(108, "G major"),
        "trap" to Pair(140, "F# minor"),
        "punk_rock" to Pair(172, "E minor"),
        "shoegaze" to Pair(96, "A major"),
        "darkwave" to Pair(122, "C minor"),
        "eurodance" to Pair(138, "F minor"),
        "uk_garage" to Pair(132, "G minor"),
        "flamenco_pop" to Pair(98, "A minor"),
        "city_pop" to Pair(112, "F# minor"),
        "electro_swing" to Pair(120, "F minor"),
        "singer_songwriter" to Pair(95, "D major"),
        "art_pop" to Pair(112, "C minor"),
        "dance_pop" to Pair(124, "F minor"),
        "tropical_house" to Pair(118, "G major"),
        "future_bass" to Pair(150, "D minor"),
        "indie_electropop" to Pair(116, "A minor"),
        "french_chanson" to Pair(90, "C minor"),
        "power_ballad" to Pair(68, "Eb major"),
        "progressive_rock" to Pair(112, "E minor"),
        "ska_punk" to Pair(160, "A minor"),
        "new_romantic" to Pair(120, "B minor"),
        "middle_eastern_pop" to Pair(100, "F# minor"),
        "moombahton" to Pair(108, "A minor"),
        "trip_hop" to Pair(88, "D minor"),
        "vaporwave" to Pair(92, "G minor"),
        "glam_rock" to Pair(124, "E major"),
    )

private val MUSIC_XL_STYLE_BPM_GUARDS: Map<String, Pair<Int, Int>> =
    mapOf(
        "drum and bass" to Pair(168, 182),
        "dubstep" to Pair(132, 148),
        "hardstyle" to Pair(145, 155),
        "eurodance" to Pair(134, 142),
        "trance" to Pair(134, 142),
        "techno" to Pair(126, 136),
        "edm" to Pair(124, 132),
        "future_bass" to Pair(140, 155),
        "ballad" to Pair(60, 92),
        "country_pop" to Pair(88, 106),
        "luna" to Pair(110, 122),
    )

fun musicStyleDefaultBpm(styleKey: String): Int =
    MUSIC_STYLE_BPM_KEYSCALE[styleKey.trim().lowercase()]?.first ?: 118

fun musicStyleBaseKeyscale(styleKey: String): String =
    MUSIC_STYLE_BPM_KEYSCALE[styleKey.trim().lowercase()]?.second ?: "C major"

fun coerceMusicXlBpmForStyle(
    styleKey: String,
    bpm: Int,
    fallbackBpm: Int = 118,
): Int {
    val fallback =
        MUSIC_STYLE_BPM_KEYSCALE[styleKey.trim().lowercase()]?.first ?: fallbackBpm
    val n = bpm.coerceIn(10, 300)
    val guard = MUSIC_XL_STYLE_BPM_GUARDS[styleKey.trim().lowercase()] ?: return n
    return if (n < guard.first || n > guard.second) fallback else n
}

// --- inferKeyscaleForWizardV2 (порт musicWizardV2Keyscale.ts) ---

private val MINOR_KEYS =
    listOf(
        "C minor", "C# minor", "D minor", "D# minor", "E minor", "Eb minor", "F minor",
        "F# minor", "G minor", "G# minor", "A minor", "Bb minor", "B minor",
    )

private val MAJOR_KEYS =
    listOf(
        "C major", "C# major", "D major", "Eb major", "E major", "F major", "F# major",
        "G major", "Ab major", "A major", "Bb major", "B major",
    )

private val MINOR_MOOD_HINTS =
    listOf(
        "anguish", "angst", "bleak", "blue", "breakup", "crying", "cry", "dark", "death",
        "depress", "empt", "farewell", "fear", "funeral", "goodbye", "grief", "heartbreak",
        "hollow", "lonel", "longing", "loss", "melanchol", "mourn", "night", "nowhere", "rain",
        "sad", "sobbing", "sorrow", "tear", "tears", "winter", "wound", "бед", "болит", "боль",
        "болю", "война", "гаснет", "гнев", "груст", "дожди", "дожд", "дрож", "забыть", "кров",
        "мрак", "навсегда", "не верн", "не вернут", "ночи", "ночь", "один", "одиноч", "одноч",
        "плач", "плачу", "покойн", "потер", "прощай", "прощан", "пусто", "пустот", "пыт",
        "разлук", "слез", "слёз", "смерт", "снег", "страх", "стыд", "суиц", "судьб", "темн",
        "тоск", "тошн", "траур", "тревог", "тьм", "тьмы", "умира", "устал", "холод", "холодн",
        "чуж", "чёрн", "черный", "шрамы", "уходи",
    )

private val MAJOR_MOOD_HINTS =
    listOf(
        "april", "beach", "bright", "celebrat", "champagne", "dance", "daylight", "dreams come",
        "festival", "fiesta", "freed", "glow", "graduat", "happy", "holiday", "honeymoon", "hug",
        "joy", "june", "kiss", "laugh", "light", "parade", "party", "rainbow", "shine", "smile",
        "smiling", "spring", "summer", "sun", "sunny", "sunrise", "sunset", "sweet", "together",
        "victory", "wedding", "win", "бал", "блест", "блеск", "весн", "весен", "востор", "грац",
        "детск", "карусел", "крыл", "лето", "луч", "лучи", "майск", "мечт", "молод", "надежд",
        "парад", "поцел", "радуг", "радост", "рождеств", "свадьб", "сия", "смех", "смеш", "солнц",
        "счастл", "счасть", "танец", "торжеств", "утро", "улыб", "фиест", "хоровод", "цвет",
        "цветы", "чудес", "чудо", "шампан", "шутк", "юбилей", "ясли",
    )

private fun hashStr(s: String): Int {
    var h = 0
    for (ch in s) {
        h = (31 * h + ch.code) or 0
    }
    return kotlin.math.abs(h)
}

private fun countHintHits(
    text: String,
    hints: List<String>,
): Int = hints.count { text.contains(it) }

private fun isMinorName(k: String): Boolean = k.trim().lowercase().endsWith(" minor")

private fun pickFromPool(
    pool: List<String>,
    seed: String,
    salt: Int,
): String {
    val h = hashStr("$seed::$salt")
    return pool[h % pool.size]
}

/** Ключ/тональность для рендера Music v2 (порт `inferKeyscaleForWizardV2`). */
fun inferKeyscaleForWizardV2(
    style: String,
    theme: String,
    lyrics: String,
): String {
    val text = "${theme}\n$lyrics".lowercase()
    val styleKey = (style.ifBlank { "pop" }).trim().lowercase()
    val base = musicStyleBaseKeyscale(styleKey)
    val seedCore = "$styleKey\n${text.take(4000)}"

    val minorHits = countHintHits(text, MINOR_MOOD_HINTS)
    val majorHits = countHintHits(text, MAJOR_MOOD_HINTS)
    val delta = minorHits - majorHits

    return when {
        delta >= 2 -> pickFromPool(MINOR_KEYS, seedCore, 1)
        delta <= -2 -> pickFromPool(MAJOR_KEYS, seedCore, 2)
        delta == 1 -> pickFromPool(MINOR_KEYS, seedCore, 3)
        delta == -1 -> pickFromPool(MAJOR_KEYS, seedCore, 4)
        isMinorName(base) -> pickFromPool(MINOR_KEYS, seedCore, 5)
        else -> pickFromPool(MAJOR_KEYS, seedCore, 6)
    }
}

fun clampForSuggestProductionApi(
    temperature: Float,
    cfgScale: Float,
    topP: Float,
): Triple<Float, Float, Float> =
    Triple(
        temperature.coerceIn(0f, 1f),
        cfgScale.coerceIn(1f, 4f),
        topP.coerceIn(0.8f, 0.98f),
    )

/** На мобильном клиенте доступен только XL Base; Turbo не выбирается в UI. */
fun mobileSongsUsesXlBasePipeline(): Boolean = true

const val MUSIC_XL_SOURCE_MODE = "xl_base_sft_tab"
