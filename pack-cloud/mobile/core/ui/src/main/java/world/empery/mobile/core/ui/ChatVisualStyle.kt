/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persisted chat thread visual identity (Standard bubble vs Elite structural).
 * Shared across app/profile without pulling feature:chat into profile.
 *
 * Invariants:
 * - Missing or unknown stored values default to [ELITE]; an explicit STANDARD value remains respected.
 *
 * Related:
 * - ChatVisualStylePreferences, feature.chat.ChatVisualStrategy, LocalChatVisualStyle
 */
package world.empery.mobile.core.ui

import android.content.Context

enum class ChatVisualStyle {
    /** Classic bubbles, borders, compact density. */
    STANDARD,

    /** Text-first structural layout: minimal chrome, timeline separators. */
    ELITE,
    ;

    companion object {
        fun fromStorage(raw: String?): ChatVisualStyle =
            when (raw?.lowercase()?.trim()) {
                "elite", "structural", "premium_chat" -> ELITE
                "standard", "bubble", "classic" -> STANDARD
                else -> ELITE
            }

        fun toStorage(value: ChatVisualStyle): String =
            when (value) {
                STANDARD -> "standard"
                ELITE -> "elite"
            }
    }
}

object ChatVisualStylePreferences {
    private const val PREFS = "empery_mobile_ui"
    private const val KEY_CHAT_VISUAL_STYLE = "chat_visual_style"

    fun get(context: Context): ChatVisualStyle {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return ChatVisualStyle.fromStorage(p.getString(KEY_CHAT_VISUAL_STYLE, null))
    }

    fun set(context: Context, style: ChatVisualStyle) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_CHAT_VISUAL_STYLE, ChatVisualStyle.toStorage(style))
            .apply()
    }
}
