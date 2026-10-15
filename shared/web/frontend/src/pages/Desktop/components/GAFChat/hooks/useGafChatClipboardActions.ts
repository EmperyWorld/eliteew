/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clipboard copy actions for GAF Chat message plain text and partner username.
 *
 * Invariants:
 * - Empty/whitespace-only payloads show toastNothingToCopy; no clipboard write attempted.
 * - Username copy normalizes to @prefix when missing.
 *
 * Related:
 * - GAFChatApp.tsx
 * - components/GafChatAppWorkspace.tsx
 */
import { safeCopyToClipboard } from '@/utils/clipboard';
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { toast } from 'sonner';

export function useGafChatClipboardActions(t: TFunction<'gafChat'>) {
	const handleCopyMessagePlainText = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed) {
				toast(t('toastNothingToCopy'));
				return;
			}
			const copied = await safeCopyToClipboard(trimmed);
			if (copied) {
				toast.success(t('toastCopied'));
			} else {
				toast.error(t('toastCopyFailed'));
			}
		},
		[t]
	);

	const handleCopyPartnerUsername = useCallback(
		async (username: string | null | undefined) => {
			const u = username?.trim();
			if (!u) {
				toast(t('toastNothingToCopy'));
				return;
			}
			const line = u.startsWith('@') ? u : `@${u}`;
			const copied = await safeCopyToClipboard(line);
			if (copied) {
				toast.success(t('copyUsernameToast'));
			} else {
				toast.error(t('toastCopyFailed'));
			}
		},
		[t]
	);

	return { handleCopyMessagePlainText, handleCopyPartnerUsername };
}
