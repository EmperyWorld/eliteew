/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persistent/dismissible hint that the chat shows only the latest reply (plan 15 R01).
 *
 * Invariants:
 * - Dismissal is per principal via ``companionTranscriptHintStorage``.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptChatContent.tsx
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	dismissTranscriptLatestReplyHint,
	isTranscriptLatestReplyHintDismissed,
} from '@/features/ewa/companionUx/companionTranscriptHintStorage';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionTranscriptLatestReplyHintProps = {
	principalId: string;
	/** When true, user can dismiss once; when false, hint stays subtle but persistent. */
	dismissible?: boolean;
};

export function CompanionTranscriptLatestReplyHint({
	principalId,
	dismissible = true,
}: CompanionTranscriptLatestReplyHintProps) {
	const { t } = useTranslation('marketing');
	const [dismissed, setDismissed] = useState(() =>
		dismissible ? isTranscriptLatestReplyHintDismissed(principalId) : false
	);

	if (dismissible && dismissed) return null;

	const handleDismiss = () => {
		dismissTranscriptLatestReplyHint(principalId);
		setDismissed(true);
	};

	return (
		<div
			className={cn(
				'mb-2 flex items-start justify-between gap-2 rounded-xl border border-white/10',
				'bg-white/4 px-2.5 py-2 text-(--companion-text-soft)'
			)}
			data-testid="ewa-companion-transcript-latest-reply-hint"
			role="note"
		>
			<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-[11px] leading-snug')}>
				{t('ewaCompanion.chatTranscriptLatestReplyHint')}
			</p>
			{dismissible ? (
				<button
					type="button"
					className={cn(
						'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
						'text-(--companion-aura) hover:bg-(--companion-aura)/10',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={handleDismiss}
				>
					{t('ewaCompanion.chatTranscriptLatestReplyHintDismiss')}
				</button>
			) : null}
		</div>
	);
}
