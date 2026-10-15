/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-app confirm dialog for reversible/destructive voice commands (replaces window.confirm).
 *
 * Invariants:
 * - Rendered only when `open` with transcript; closes on cancel or confirm.
 *
 * Related:
 * - `intent/runVoiceCommandIntent.ts`, `VoiceCommandCenter.tsx`
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export interface VoiceCommandConfirmModalProps {
	open: boolean;
	transcript: string;
	onClose: () => void;
	onConfirm: () => void;
}

export function VoiceCommandConfirmModal({
	open,
	transcript,
	onClose,
	onConfirm,
}: VoiceCommandConfirmModalProps) {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'voiceCommand' });
	const descId = useId();
	if (!open) return null;

	return (
		<DesktopAppModalFrame
			title={t('confirm.executeTitle')}
			onClose={onClose}
			className="max-w-md"
		>
			<p
				id={descId}
				className={cn(
					DESKTOP_TYPOGRAPHY.body,
					'text-(--desktop-text-secondary)'
				)}
			>
				{t('confirm.executeBody', { transcript })}
			</p>
			<div className="mt-5 flex justify-end gap-2">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClose}
				>
					{t('confirm.cancel')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					onClick={() => {
						onConfirm();
						onClose();
					}}
				>
					{t('confirm.confirm')}
				</DesktopAppButton>
			</div>
		</DesktopAppModalFrame>
	);
}
