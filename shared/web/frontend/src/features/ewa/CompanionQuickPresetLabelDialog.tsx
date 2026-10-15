/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop-styled modal for saving or renaming a companion quick preset label (replaces `window.prompt`).
 *
 * Invariants:
 * - Confirm is disabled when label input is empty after trim.
 * - Parent owns API calls; dialog only collects label text.
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-CHAT-PIPELINE-2026-05.md
 */

import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { CompanionQuickPresetLabelDialogState } from '@/features/ewa/companionQuickPresetDialogTypes';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionQuickPresetLabelDialogProps = {
	state: CompanionQuickPresetLabelDialogState;
	inputRef: RefObject<HTMLInputElement | null>;
	onValueChange: (value: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
};

export function CompanionQuickPresetLabelDialog({
	state,
	inputRef,
	onValueChange,
	onCancel,
	onConfirm,
}: CompanionQuickPresetLabelDialogProps) {
	const { t } = useTranslation('marketing');
	const titleId = 'ewa-quick-preset-label-title';

	return (
		<div
			className="absolute inset-0 z-20 flex items-end justify-center bg-black/20 p-3 backdrop-blur-[2px] sm:items-center"
			data-testid="ewa-companion-quick-preset-label-dialog"
		>
			<form
				className={cn(
					'w-full max-w-sm rounded-(--desktop-radius-frame)',
					'border border-(--desktop-border-subtle) bg-(--desktop-surface-base)',
					'p-4 shadow-2xl'
				)}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onSubmit={(event) => {
					event.preventDefault();
					onConfirm();
				}}
			>
				<h2
					id={titleId}
					className={cn(
						DESKTOP_TYPOGRAPHY.subtitle,
						'text-(--desktop-text-primary)'
					)}
				>
					{state.mode === 'save'
						? t('ewaCompanion.quickPresetPromptName')
						: t('ewaCompanion.quickPresetRenamePrompt')}
				</h2>
				<input
					ref={inputRef}
					className={cn(
						'mt-3 w-full rounded-(--desktop-radius-section)',
						'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
						'px-3 py-2 text-[14px] text-(--desktop-text-primary) outline-none',
						'focus:border-(--desktop-accent-primary) focus:ring-2 focus:ring-(--desktop-accent-primary)/25'
					)}
					value={state.value}
					maxLength={80}
					onChange={(event) => onValueChange(event.target.value)}
				/>
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
						type="submit"
						variant="accent"
						size="sm"
						disabled={!state.value.trim()}
					>
						{state.mode === 'save'
							? t('ewaCompanion.quickPresetDialogConfirm')
							: t('ewaCompanion.quickPresetDialogConfirmRename')}
					</DesktopAppButton>
				</div>
			</form>
		</div>
	);
}
