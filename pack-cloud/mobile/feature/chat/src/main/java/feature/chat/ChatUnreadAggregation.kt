/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single source of truth for chat unread aggregation used by bottom-nav badge and list header chip.
 *
 * Invariants:
 * - Tab badge and list header chip must call [totalChatUnreadCount] — never a second counter that can drift.
 * - Negative per-chat unread values coerce to zero before summing.
 *
 * Related:
 * - ChatFeature.kt, ChatListPane.kt, TabHostChrome.kt, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md (W4 U5)
 */
package feature.chat

import world.empery.mobile.core.storage.ChatEntity

/**
 * Total unread messages across the chat list (SSOT for Chat tab badge + list header chip).
 *
 * This is the sum of per-chat [ChatEntity.unreadCount], not the count of chats with unread > 0.
 */
fun totalChatUnreadCount(chats: List<ChatEntity>): Int =
    chats.sumOf { chat -> chat.unreadCount.coerceAtLeast(0) }
