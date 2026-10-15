/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deny-by-default capability resolution for Desktop AI Chat collaboration DTO fields.
 *
 * Invariants:
 * - Missing or partial `capabilities` from API resolves to false for every key.
 *
 * Related:
 * - api/desktopChatClient.ts, documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
 */
import type {
	DesktopAiChatItem,
	DesktopChatCapabilities,
	DesktopChatCapabilityKey,
} from '../api/desktopChatClient';

export const DESKTOP_CHAT_CAPABILITY_KEYS: readonly DesktopChatCapabilityKey[] =
	[
		'can_stream',
		'can_attach',
		'can_regenerate',
		'can_delete_messages',
		'can_manage_project',
		'can_patch_settings',
		'can_invite',
		'can_manage_members',
		'can_leave',
		'can_delete_chat',
		'can_solo_slot',
		'can_export',
	] as const;

const EMPTY_CAPABILITIES: DesktopChatCapabilities = Object.fromEntries(
	DESKTOP_CHAT_CAPABILITY_KEYS.map((k) => [k, false])
) as DesktopChatCapabilities;

/** Owner-only solo chats without API collab fields get full owner capabilities. */
function legacyOwnerCapabilities(): DesktopChatCapabilities {
	return {
		can_stream: true,
		can_attach: true,
		can_regenerate: true,
		can_delete_messages: true,
		can_manage_project: true,
		can_patch_settings: true,
		can_invite: true,
		can_manage_members: true,
		can_leave: false,
		can_delete_chat: true,
		can_solo_slot: true,
		can_export: true,
	};
}

export function resolveDesktopChatCapabilities(
	chat: DesktopAiChatItem | null | undefined
): DesktopChatCapabilities {
	if (!chat) {
		return { ...EMPTY_CAPABILITIES };
	}
	const raw = chat.capabilities;
	if (!raw || typeof raw !== 'object') {
		if (chat.viewer_role === 'owner' || !chat.viewer_role) {
			return legacyOwnerCapabilities();
		}
		return { ...EMPTY_CAPABILITIES };
	}
	const out = { ...EMPTY_CAPABILITIES };
	for (const key of DESKTOP_CHAT_CAPABILITY_KEYS) {
		out[key] = raw[key] === true;
	}
	return out;
}

export function isDesktopChatOwner(
	chat: DesktopAiChatItem | null | undefined
): boolean {
	if (!chat) return false;
	if (chat.viewer_role === 'owner') return true;
	if (!chat.viewer_role && chat.capabilities == null) return true;
	return false;
}

export function hasDesktopChatCapability(
	chat: DesktopAiChatItem | null | undefined,
	key: DesktopChatCapabilityKey
): boolean {
	return resolveDesktopChatCapabilities(chat)[key] ?? false;
}
