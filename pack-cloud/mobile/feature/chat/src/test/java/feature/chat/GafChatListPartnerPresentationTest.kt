/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for lite chat list partner mapping and row subtitle/badge presentation helpers.
 *
 * Invariants:
 * - Username subtitle is omitted when it duplicates the visible display name.
 *
 * Related:
 * - GafChatListPartnerPresentation.kt, ChatRepository.refreshChatList
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.GafChatPartnerLiteDto
import world.empery.mobile.core.storage.ChatEntity

class GafChatListPartnerPresentationTest {

    @Test
    fun mapLitePartnerToListMeta_readsRelationshipFlags() {
        val meta =
            mapLitePartnerToListMeta(
                GafChatPartnerLiteDto(
                    id = "u1",
                    username = "alice",
                    full_name = "Alice Example",
                    is_muted = true,
                    is_blocked = false,
                    blocked_by_partner = true,
                ),
            )
        assertEquals("alice", meta.username)
        assertTrue(meta.isPartnerMuted)
        assertTrue(meta.blockedByPartner)
    }

    @Test
    fun resolveChatListPartnerSubtitle_showsHandleWhenDistinctFromDisplayName() {
        val subtitle =
            resolveChatListPartnerSubtitle(
                displayName = "Alice Example",
                meta = GafChatListPartnerMeta(username = "alice"),
            )
        assertEquals("@alice", subtitle)
    }

    @Test
    fun resolveChatListPartnerSubtitle_omitsDuplicateHandle() {
        val subtitle =
            resolveChatListPartnerSubtitle(
                displayName = "@alice",
                meta = GafChatListPartnerMeta(username = "alice"),
            )
        assertNull(subtitle)
    }

    @Test
    fun mergePartnerMeta_preservesTrustedAndAdminBadgeFromExisting() {
        val merged =
            mergeGafChatListPartnerMeta(
                existing =
                    GafChatListPartnerMeta(
                        isTrusted = true,
                        adminBadgeLabel = "Ambassador",
                    ),
                incoming = GafChatListPartnerMeta(username = "bob"),
            )
        assertTrue(merged.isTrusted)
        assertEquals("Ambassador", merged.adminBadgeLabel)
        assertEquals("bob", merged.username)
    }

    @Test
    fun partnerMetaJsonRoundTrip() {
        val original =
            mapOf(
                "c1" to
                    GafChatListPartnerMeta(
                        username = "poet",
                        isPartnerBlocked = true,
                        isTrusted = true,
                        adminBadgeLabel = "VIP",
                    ),
            )
        val parsed = gafChatListPartnerMetaMapFromJson(gafChatListPartnerMetaMapToJson(original))
        assertEquals(original, parsed)
    }

    @Test
    fun resolveChatListRowPresentation_usesPartnerNameFallback() {
        val row =
            resolveChatListRowPresentation(
                chat =
                    ChatEntity(
                        chatId = "11111111-1111-1111-1111-111111111111",
                        unreadCount = 0,
                        lastMessagePreview = "hi",
                        partnerName = "Poet",
                    ),
                meta = GafChatListPartnerMeta(username = "poet"),
                displayNameFallback = "Чат fallback",
            )
        assertEquals("Poet", row.displayName)
        assertNull(row.partnerSubtitle)
    }
}
