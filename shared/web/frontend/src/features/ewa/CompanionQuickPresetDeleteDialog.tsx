/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop-styled confirm modal for deleting a user quick preset (replaces `window.confirm`).
 *
 * Invariants:
 * - Destructive confirm only; parent performs API delete after `onConfirm`.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionQuickPresetDeleteDialogProps = {
	label: string;
	onCancel: () => void;
	onConfirm: () => void;
};

export function CompanionQuickPresetDeleteDialog({
	label,
	onCancel,
	onConfirm,
}: CompanionQuickPresetDeleteDialogProps) {
	const { t } = useTranslation('marketing');
	const titleId = 'ewa-quick-preset-delete-title';
	const bodyId = 'ewa-quick-preset-delete-body';

	return (
		<div
			className="absolute inset-0 z-20 flex items-end justify-center bg-black/20 p-3 backdrop-blur-[2px] sm:items-center"
			data-testid="ewa-companion-quick-preset-delete-dialog"
		>
			<div
				className={cn(
					'w-full max-w-sm rounded-(--desktop-radius-frame)',
					'border border-(--desktop-border-subtle) bg-(--desktop-surface-base)',
					'p-4 shadow-2xl'
				)}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={bodyId}
			>
				<h2
					id={titleId}
					className={cn(
						DESKTOP_TYPOGRAPHY.subtitle,
						'text-(--desktop-text-primary)'
					)}
				>
					{t('ewaCompanion.quickPresetDeleteDialogTitle')}
				</h2>
				<p
					id={bodyId}
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'mt-2 text-(--desktop-text-secondary)'
					)}
				>
					{t('ewaCompanion.quickPresetDeleteConfirm', { label })}
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={onCancel}
					>
						{t('ewaCompanion.quickPresetDialogCancel')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="danger"
						size="sm"
						onClick={onConfirm}
					>
						{t('ewaCompanion.quickPresetDeleteDialogConfirm')}
					</DesktopAppButton>
				</div>
			</div>
		</div>
	);
}
