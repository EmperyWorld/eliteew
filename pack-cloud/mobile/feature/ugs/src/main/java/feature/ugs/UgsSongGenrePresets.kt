/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS song genre quick presets aligned with web GENRE_QUICK_PRESETS_UGS_V2.
 *
 * Invariants:
 * - `style` keys must match API MUSIC_STYLE_FORM_DEFAULTS / web catalog.
 *
 * Related:
 * - UgsSongsScreen.kt, musicGenreQuickPresets.ts
 */
package feature.ugs

/**
 * Жанры для экрана «Песни»: ключи совпадают с веб-каталогом
 * `GENRE_QUICK_PRESETS_UGS_V2` (MusicGenerator / musicGenreQuickPresets.ts) и с MUSIC_STYLE_FORM_DEFAULTS на API.
 */
data class GenreQuickPreset(
    val style: String,
    val label: String,
)

@Suppress("ConstPropertyName")
object UgsSongGenrePresets {
    /** Полный список как на веб «Версия 2» / XL (Turbo и Base). */
    val ugsV2: List<GenreQuickPreset> = listOf(
    GenreQuickPreset(style = "pop", label = "Pop"),
    GenreQuickPreset(style = "rock", label = "Rock"),
    GenreQuickPreset(style = "electronic", label = "Electronic / dance"),
    GenreQuickPreset(style = "ballad", label = "Ballad"),
    GenreQuickPreset(style = "hip_hop", label = "Hip-hop / rap"),
    GenreQuickPreset(style = "drum and bass", label = "Drum & bass"),
    GenreQuickPreset(style = "classical", label = "Art-pop / neoclassical"),
    GenreQuickPreset(style = "dubstep", label = "Dubstep"),
    GenreQuickPreset(style = "lofi_chill", label = "Lo-fi / chill"),
    GenreQuickPreset(style = "noir_cabaret", label = "Noir / cabaret"),
    GenreQuickPreset(style = "luna", label = "Luna (инди electro)"),
    GenreQuickPreset(style = "rnb_classic_female", label = "R&B / соул (female lead)"),
    GenreQuickPreset(style = "folk", label = "Folk / акустика"),
    GenreQuickPreset(style = "reggaeton", label = "Reggaeton"),
    GenreQuickPreset(style = "afrobeats", label = "Afrobeats"),
    GenreQuickPreset(style = "phonk", label = "Phonk"),
    GenreQuickPreset(style = "hyperpop", label = "Hyperpop"),
    GenreQuickPreset(style = "bedroom_pop", label = "Bedroom pop"),
    GenreQuickPreset(style = "synthwave", label = "Synthwave"),
    GenreQuickPreset(style = "emo_rap", label = "Emo rap / melodic rap"),
    GenreQuickPreset(style = "country_pop", label = "Country pop"),
    GenreQuickPreset(style = "kpop", label = "K-pop"),
    GenreQuickPreset(style = "metal", label = "Metal / heavy"),
    GenreQuickPreset(style = "indie_rock", label = "Indie / alt-rock"),
    GenreQuickPreset(style = "grunge", label = "Grunge / alt 90s"),
    GenreQuickPreset(style = "soul", label = "Soul / Motown"),
    GenreQuickPreset(style = "latin_pop", label = "Latin pop"),
    GenreQuickPreset(style = "disco", label = "Disco / nu-disco"),
    GenreQuickPreset(style = "amapiano", label = "Amapiano"),
    GenreQuickPreset(style = "bollywood_pop", label = "Bollywood pop"),
    GenreQuickPreset(style = "mandopop", label = "Mandopop (C-pop)"),
    GenreQuickPreset(style = "drill", label = "Drill"),
    GenreQuickPreset(style = "reggae", label = "Reggae / roots"),
    GenreQuickPreset(style = "baile_funk", label = "Baile funk"),
    GenreQuickPreset(style = "punjabi_pop", label = "Bhangra / Punjabi pop"),
    GenreQuickPreset(style = "neo_soul", label = "Neo-soul"),
    GenreQuickPreset(style = "gospel_soul", label = "Gospel / соул-гаспел"),
    GenreQuickPreset(style = "indie_folk_pop", label = "Indie folk / stomp"),
    GenreQuickPreset(style = "boogie_funk", label = "Boogie / disco-funk"),
    GenreQuickPreset(style = "chillout", label = "Downtempo / lounge"),
    GenreQuickPreset(style = "jazz", label = "Jazz / neo-jazz vocal"),
    GenreQuickPreset(style = "chicago_blues", label = "Chicago blues"),
    GenreQuickPreset(style = "house", label = "House"),
    GenreQuickPreset(style = "techno", label = "Techno"),
    GenreQuickPreset(style = "trance", label = "Trance / uplifting"),
    GenreQuickPreset(style = "edm", label = "EDM / big room"),
    GenreQuickPreset(style = "hardstyle", label = "Hardstyle"),
    GenreQuickPreset(style = "trap", label = "Trap"),
    GenreQuickPreset(style = "punk_rock", label = "Punk rock"),
    GenreQuickPreset(style = "shoegaze", label = "Shoegaze / dream pop"),
    GenreQuickPreset(style = "darkwave", label = "Darkwave / coldwave"),
    GenreQuickPreset(style = "eurodance", label = "Eurodance / 90s"),
    GenreQuickPreset(style = "electro_swing", label = "Electro swing"),
    GenreQuickPreset(style = "uk_garage", label = "UK garage / 2-step"),
    GenreQuickPreset(style = "flamenco_pop", label = "Flamenco pop"),
    GenreQuickPreset(style = "city_pop", label = "City pop (J-pop)"),
    GenreQuickPreset(style = "ambient_instrumental", label = "Ambient (инстр.)"),
    GenreQuickPreset(style = "post_rock_instrumental", label = "Post-rock (инстр.)"),
    GenreQuickPreset(style = "cinematic_instrumental", label = "Cinematic (инстр.)"),
    GenreQuickPreset(style = "bossa_instrumental", label = "Bossa (инстр.)"),
    GenreQuickPreset(style = "funk_instrumental", label = "Funk (инстр.)"),
    GenreQuickPreset(style = "celtic_instrumental", label = "Celtic (instr.)"),
    GenreQuickPreset(style = "singer_songwriter", label = "Singer-songwriter"),
    GenreQuickPreset(style = "art_pop", label = "Art pop / avant-pop"),
    GenreQuickPreset(style = "dance_pop", label = "Dance pop"),
    GenreQuickPreset(style = "tropical_house", label = "Tropical house"),
    GenreQuickPreset(style = "future_bass", label = "Future bass / melodic EDM"),
    GenreQuickPreset(style = "indie_electropop", label = "Indie electropop"),
    GenreQuickPreset(style = "french_chanson", label = "Chanson"),
    GenreQuickPreset(style = "power_ballad", label = "Power ballad"),
    GenreQuickPreset(style = "progressive_rock", label = "Progressive rock"),
    GenreQuickPreset(style = "ska_punk", label = "Ska / ska-punk"),
    GenreQuickPreset(style = "new_romantic", label = "New wave / synth 80s"),
    GenreQuickPreset(style = "middle_eastern_pop", label = "Middle Eastern pop"),
    GenreQuickPreset(style = "moombahton", label = "Moombahton / dembow"),
    GenreQuickPreset(style = "trip_hop", label = "Trip-hop / downtempo"),
    GenreQuickPreset(style = "vaporwave", label = "Vapor / chill wave"),
    GenreQuickPreset(style = "glam_rock", label = "Glam / arena rock"),
    )
}
