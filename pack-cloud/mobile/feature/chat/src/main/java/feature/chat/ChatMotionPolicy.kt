/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolves GAF chat motion from Android animator scale and the in-app profile preference.
 * Exposes a pure policy for deterministic tests and one Compose reader for the message timeline.
 *
 * Invariants:
 * - Either system or profile reduced-motion setting disables item, content, and gap transitions.
 *
 * Related:
 * - MobileMotionPolicy.kt, ProfileRoadmapSupport.kt, ChatMessageTimeline.kt
 */
package feature.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import feature.profile.ProfileAccessibilityPreferences
import world.empery.mobile.core.ui.rememberReduceMotionEnabled

internal data class ChatMotionPolicy(
    val reduceMotion: Boolean,
    val animateItems: Boolean,
    val animateContent: Boolean,
    val animateGaps: Boolean,
)

internal fun resolveChatMotionPolicy(
    systemReduceMotion: Boolean,
    profileReduceMotion: Boolean,
): ChatMotionPolicy {
    val reduceMotion = systemReduceMotion || profileReduceMotion
    return ChatMotionPolicy(
        reduceMotion = reduceMotion,
        animateItems = !reduceMotion,
        animateContent = !reduceMotion,
        animateGaps = !reduceMotion,
    )
}

@Composable
internal fun rememberChatMotionPolicy(): ChatMotionPolicy {
    val context = LocalContext.current
    val systemReduceMotion = rememberReduceMotionEnabled()
    val profileReduceMotion = ProfileAccessibilityPreferences.isReduceMotion(context)
    return remember(systemReduceMotion, profileReduceMotion) {
        resolveChatMotionPolicy(
            systemReduceMotion = systemReduceMotion,
            profileReduceMotion = profileReduceMotion,
        )
    }
}
