/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared BASE path and i18n error helper for Desktop AI Chat HTTP/SSE client modules.
 *
 * Invariants:
 * - BASE stays `/api/v1/desktop/ai-chat` (public API prefix).
 *
 * Related:
 * - ./rest.ts
 * - ./stream.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import i18n from '../../../../i18n/config';

export const BASE = '/api/v1/desktop/ai-chat';

export function tDesktopAiApiError(
	key: string,
	options?: Record<string, string | number>
): string {
	return i18n.t(`desktopAiChat:apiErrors.${key}`, options);
}
