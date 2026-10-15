/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps lite GAF chat list partner fields to list-row presentation (username, relationship flags, badges).
 *
 * Invariants:
 * - Trusted/admin badge fields are optional; lite API may omit them until backend extends `/chats/lite`.
 *
 * Related:
 * - ChatRepository.refreshChatList, GafChatPartnerAccountBadges.kt, ChatFeature.kt
 */
package feature.chat

import org.json.JSONObject
import world.empery.mobile.core.network.api.GafChatPartnerLiteDto
import world.empery.mobile.core.storage.ChatEntity

data class GafChatListPartnerMeta(
    val username: String? = null,
    val isPartnerMuted: Boolean = false,
    val isPartnerBlocked: Boolean = false,
    val blockedByPartner: Boolean = false,
    val isTrusted: Boolean = false,
    val adminBadgeLabel: String? = null,
    val adminBadgeHint: String? = null,
)

data class GafChatListRowPresentation(
    val displayName: String,
    val partnerSubtitle: String?,
    val meta: GafChatListPartnerMeta,
)

fun mapLitePartnerToListMeta(partner: GafChatPartnerLiteDto): GafChatListPartnerMeta =
    GafChatListPartnerMeta(
        username = sanitizeGafOptionalString(partner.username),
        isPartnerMuted = partner.is_muted,
        isPartnerBlocked = partner.is_blocked,
        blockedByPartner = partner.blocked_by_partner,
    )

fun mergeGafChatListPartnerMeta(
    existing: GafChatListPartnerMeta?,
    incoming: GafChatListPartnerMeta,
): GafChatListPartnerMeta {
    if (existing == null) return incoming
    return GafChatListPartnerMeta(
        username = incoming.username ?: existing.username,
        isPartnerMuted = incoming.isPartnerMuted,
        isPartnerBlocked = incoming.isPartnerBlocked,
        blockedByPartner = incoming.blockedByPartner,
        isTrusted = incoming.isTrusted || existing.isTrusted,
        adminBadgeLabel = incoming.adminBadgeLabel?.takeIf { it.isNotBlank() } ?: existing.adminBadgeLabel,
        adminBadgeHint = incoming.adminBadgeHint?.takeIf { it.isNotBlank() } ?: existing.adminBadgeHint,
    )
}

fun resolveChatListPartnerSubtitle(
    displayName: String,
    meta: GafChatListPartnerMeta?,
): String? {
    val username = meta?.username?.trim().orEmpty()
    if (username.isBlank()) return null
    val handle = "@$username"
    val normalizedDisplay = displayName.trim()
    if (normalizedDisplay.equals(username, ignoreCase = true)) return null
    if (normalizedDisplay.equals(handle, ignoreCase = true)) return null
    return handle
}

fun resolveChatListRowPresentation(
    chat: ChatEntity,
    meta: GafChatListPartnerMeta?,
    displayNameFallback: String,
): GafChatListRowPresentation {
    val displayName =
        chat.partnerName?.trim()?.takeIf { it.isNotEmpty() }
            ?: displayNameFallback
    val partnerMeta = meta ?: GafChatListPartnerMeta()
    return GafChatListRowPresentation(
        displayName = displayName,
        partnerSubtitle = resolveChatListPartnerSubtitle(displayName, partnerMeta),
        meta = partnerMeta,
    )
}

internal fun gafChatListPartnerMetaToJson(meta: GafChatListPartnerMeta): JSONObject =
    JSONObject()
        .put("username", meta.username)
        .put("isPartnerMuted", meta.isPartnerMuted)
        .put("isPartnerBlocked", meta.isPartnerBlocked)
        .put("blockedByPartner", meta.blockedByPartner)
        .put("isTrusted", meta.isTrusted)
        .put("adminBadgeLabel", meta.adminBadgeLabel)
        .put("adminBadgeHint", meta.adminBadgeHint)

internal fun gafChatListPartnerMetaFromJson(node: JSONObject): GafChatListPartnerMeta =
    GafChatListPartnerMeta(
        username = node.optString("username").trim().takeIf { it.isNotEmpty() },
        isPartnerMuted = node.optBoolean("isPartnerMuted", false),
        isPartnerBlocked = node.optBoolean("isPartnerBlocked", false),
        blockedByPartner = node.optBoolean("blockedByPartner", false),
        isTrusted = node.optBoolean("isTrusted", false),
        adminBadgeLabel = node.optString("adminBadgeLabel").trim().takeIf { it.isNotEmpty() },
        adminBadgeHint = node.optString("adminBadgeHint").trim().takeIf { it.isNotEmpty() },
    )

internal fun gafChatListPartnerMetaMapToJson(metaByChatId: Map<String, GafChatListPartnerMeta>): String {
    val root = JSONObject()
    metaByChatId.forEach { (chatId, meta) ->
        root.put(chatId, gafChatListPartnerMetaToJson(meta))
    }
    return root.toString()
}

internal fun gafChatListPartnerMetaMapFromJson(raw: String?): Map<String, GafChatListPartnerMeta> {
    if (raw.isNullOrBlank()) return emptyMap()
    val root =
        runCatching { JSONObject(raw) }.getOrNull() ?: return emptyMap()
    val result = linkedMapOf<String, GafChatListPartnerMeta>()
    val keys = root.keys()
    while (keys.hasNext()) {
        val chatId = keys.next().toString()
        val node = root.optJSONObject(chatId) ?: continue
        result[chatId] = gafChatListPartnerMetaFromJson(node)
    }
    return result
}
