/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persisted GAF chat message typography (family / size / color) with named base presets.
 * Lives in core:ui so Profile appearance can edit without depending on feature:chat.
 *
 * Invariants:
 * - Missing/unknown storage → [ChatTypographySettings.DEFAULT] (Base preset).
 * - Selecting a preset always rewrites family + size + color together.
 * - Color DEFAULT keeps bubble-aware Material contrast (mine vs other).
 *
 * Related:
 * - ChatTypographyPreferences, LocalChatTypography, ProfileAppearanceSection
 */
package world.empery.mobile.core.ui

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp

enum class ChatFontFamilyOption {
    DEFAULT,
    SERIF,
    MONOSPACE,
    ;

    companion object {
        fun fromStorage(raw: String?): ChatFontFamilyOption =
            when (raw?.lowercase()?.trim()) {
                "serif" -> SERIF
                "mono", "monospace" -> MONOSPACE
                else -> DEFAULT
            }

        fun toStorage(value: ChatFontFamilyOption): String =
            when (value) {
                DEFAULT -> "default"
                SERIF -> "serif"
                MONOSPACE -> "monospace"
            }
    }
}

enum class ChatFontSizeOption {
    SM,
    MD,
    LG,
    XL,
    ;

    val spValue
        get() =
            when (this) {
                SM -> 13.sp
                MD -> 15.sp
                LG -> 17.sp
                XL -> 19.sp
            }

    companion object {
        fun fromStorage(raw: String?): ChatFontSizeOption =
            when (raw?.lowercase()?.trim()) {
                "sm", "small", "compact" -> SM
                "lg", "large" -> LG
                "xl", "xlarge" -> XL
                else -> MD
            }

        fun toStorage(value: ChatFontSizeOption): String =
            when (value) {
                SM -> "sm"
                MD -> "md"
                LG -> "lg"
                XL -> "xl"
            }
    }
}

enum class ChatFontColorOption {
    /** Bubble-aware Material onSurface / onPrimaryContainer. */
    DEFAULT,

    MUTED,
    PRIMARY,
    HIGH_CONTRAST,
    ;

    companion object {
        fun fromStorage(raw: String?): ChatFontColorOption =
            when (raw?.lowercase()?.trim()) {
                "muted", "variant" -> MUTED
                "primary", "accent" -> PRIMARY
                "high_contrast", "contrast", "strong" -> HIGH_CONTRAST
                else -> DEFAULT
            }

        fun toStorage(value: ChatFontColorOption): String =
            when (value) {
                DEFAULT -> "default"
                MUTED -> "muted"
                PRIMARY -> "primary"
                HIGH_CONTRAST -> "high_contrast"
            }
    }
}

/**
 * Named base presets — quick picks that set family + size + color.
 */
enum class ChatTypographyPreset {
    BASE,
    COMPACT,
    READING,
    EMPHASIS,
    SERIF_READ,
    HIGH_CONTRAST,
    ;

    fun toSettings(): ChatTypographySettings =
        when (this) {
            BASE ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.DEFAULT,
                    size = ChatFontSizeOption.MD,
                    color = ChatFontColorOption.DEFAULT,
                )
            COMPACT ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.DEFAULT,
                    size = ChatFontSizeOption.SM,
                    color = ChatFontColorOption.DEFAULT,
                )
            READING ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.DEFAULT,
                    size = ChatFontSizeOption.LG,
                    color = ChatFontColorOption.MUTED,
                )
            EMPHASIS ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.DEFAULT,
                    size = ChatFontSizeOption.MD,
                    color = ChatFontColorOption.PRIMARY,
                )
            SERIF_READ ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.SERIF,
                    size = ChatFontSizeOption.LG,
                    color = ChatFontColorOption.DEFAULT,
                )
            HIGH_CONTRAST ->
                ChatTypographySettings(
                    family = ChatFontFamilyOption.DEFAULT,
                    size = ChatFontSizeOption.XL,
                    color = ChatFontColorOption.HIGH_CONTRAST,
                )
        }

    companion object {
        fun fromStorage(raw: String?): ChatTypographyPreset? =
            when (raw?.lowercase()?.trim()) {
                "base", "default" -> BASE
                "compact", "sm" -> COMPACT
                "reading", "read" -> READING
                "emphasis", "accent" -> EMPHASIS
                "serif", "serif_read" -> SERIF_READ
                "high_contrast", "contrast" -> HIGH_CONTRAST
                else -> null
            }

        fun toStorage(value: ChatTypographyPreset): String =
            when (value) {
                BASE -> "base"
                COMPACT -> "compact"
                READING -> "reading"
                EMPHASIS -> "emphasis"
                SERIF_READ -> "serif_read"
                HIGH_CONTRAST -> "high_contrast"
            }

        fun matching(settings: ChatTypographySettings): ChatTypographyPreset? =
            entries.firstOrNull { it.toSettings() == settings }
    }
}

data class ChatTypographySettings(
    val family: ChatFontFamilyOption = ChatFontFamilyOption.DEFAULT,
    val size: ChatFontSizeOption = ChatFontSizeOption.MD,
    val color: ChatFontColorOption = ChatFontColorOption.DEFAULT,
) {
    companion object {
        val DEFAULT = ChatTypographyPreset.BASE.toSettings()
    }

    fun applyTo(base: TextStyle): TextStyle {
        val fontFamily =
            when (family) {
                ChatFontFamilyOption.DEFAULT -> FontFamily.Default
                ChatFontFamilyOption.SERIF -> FontFamily.Serif
                ChatFontFamilyOption.MONOSPACE -> FontFamily.Monospace
            }
        return base.copy(
            fontFamily = fontFamily,
            fontSize = size.spValue,
        )
    }

    @Composable
    @ReadOnlyComposable
    fun resolveBodyColor(
        isMine: Boolean,
        showBubbleSurface: Boolean,
    ): Color {
        val scheme = MaterialTheme.colorScheme
        return when (color) {
            ChatFontColorOption.MUTED -> scheme.onSurfaceVariant
            ChatFontColorOption.PRIMARY -> scheme.primary
            ChatFontColorOption.HIGH_CONTRAST -> scheme.onSurface
            ChatFontColorOption.DEFAULT ->
                if (showBubbleSurface && isMine) {
                    scheme.onPrimaryContainer
                } else {
                    scheme.onSurface
                }
        }
    }
}

object ChatTypographyPreferences {
    private const val PREFS = "empery_mobile_ui"
    private const val KEY_FAMILY = "chat_typo_family"
    private const val KEY_SIZE = "chat_typo_size"
    private const val KEY_COLOR = "chat_typo_color"
    private const val KEY_PRESET = "chat_typo_preset"

    fun get(context: Context): ChatTypographySettings {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val preset = ChatTypographyPreset.fromStorage(p.getString(KEY_PRESET, null))
        if (preset != null &&
            !p.contains(KEY_FAMILY) &&
            !p.contains(KEY_SIZE) &&
            !p.contains(KEY_COLOR)
        ) {
            return preset.toSettings()
        }
        return ChatTypographySettings(
            family = ChatFontFamilyOption.fromStorage(p.getString(KEY_FAMILY, null)),
            size = ChatFontSizeOption.fromStorage(p.getString(KEY_SIZE, null)),
            color = ChatFontColorOption.fromStorage(p.getString(KEY_COLOR, null)),
        )
    }

    fun set(
        context: Context,
        settings: ChatTypographySettings,
    ) {
        val preset = ChatTypographyPreset.matching(settings)
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FAMILY, ChatFontFamilyOption.toStorage(settings.family))
            .putString(KEY_SIZE, ChatFontSizeOption.toStorage(settings.size))
            .putString(KEY_COLOR, ChatFontColorOption.toStorage(settings.color))
            .apply {
                if (preset != null) {
                    putString(KEY_PRESET, ChatTypographyPreset.toStorage(preset))
                } else {
                    remove(KEY_PRESET)
                }
            }.apply()
    }

    fun setPreset(
        context: Context,
        preset: ChatTypographyPreset,
    ) {
        set(context, preset.toSettings())
    }
}
