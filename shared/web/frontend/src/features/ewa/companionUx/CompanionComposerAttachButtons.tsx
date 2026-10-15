/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Image attach and restore-last-message controls for companion composer layouts (U8.3 slice 14).
 *
 * Invariants:
 * - Parent owns file input ref and restore handler semantics.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { ArrowPathIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { CompanionComposerVoiceRailDensity } from '@/features/ewa/companionUx/CompanionComposerVoiceRail';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export type CompanionComposerAttachButtonsProps = {
	density: CompanionComposerVoiceRailDensity;
	buttonClassName?: string;
	pending: boolean;
	canRestoreLastMessage: boolean;
	includeRestore?: boolean;
	includeAttach?: boolean;
	onAttachImage: () => void;
	onRestoreLastMessage: () => void;
};

export function CompanionComposerAttachButtons({
	density,
	buttonClassName,
	pending,
	canRestoreLastMessage,
	includeRestore = true,
	includeAttach = true,
	onAttachImage,
	onRestoreLastMessage,
}: CompanionComposerAttachButtonsProps) {
	const { t } = useTranslation('marketing');
	const iconClass = density === 'mobile' ? 'size-3.5' : 'size-4';

	return (
		<>
			{includeAttach ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={buttonClassName}
					disabled={pending}
					onClick={onAttachImage}
					aria-label={t('ewaCompanion.chatAttachImageAria')}
					title={t('ewaCompanion.chatAttachImage')}
				>
					<PhotoIcon className={iconClass} aria-hidden />
				</DesktopAppButton>
			) : null}
			{includeRestore ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={buttonClassName}
					disabled={pending || !canRestoreLastMessage}
					onClick={onRestoreLastMessage}
					aria-label={t('ewaCompanion.chatRestoreLastMessageAria')}
					title={t('ewaCompanion.chatRestoreLastMessage')}
					data-testid="ewa-companion-restore-last-message"
				>
					<ArrowPathIcon className={iconClass} aria-hidden />
				</DesktopAppButton>
			) : null}
		</>
	);
}
