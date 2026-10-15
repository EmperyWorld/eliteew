/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clear-chat confirm modal for Assistant header overflow menu.
 *
 * Invariants:
 * - Portaled via DesktopPortaledConfirmShell; parent owns open/confirm handlers.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantAppHeader.tsx
 */
import { cn } from '@/utils/cn';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from '../DesktopAppChrome';
import { ASSISTANT_CLEAR_MODAL_CONFIRM_PULSE_CLASS } from './assistantHeaderStyles';

export type AssistantClearChatModalProps = {
	open: boolean;
	clearing: boolean;
	modalZIndex: number | { backdrop: number; content: number };
	descId: string;
	onDismiss: () => void;
	onConfirm: () => void;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantClearChatModal({
	open,
	clearing,
	modalZIndex,
	descId,
	onDismiss,
	onConfirm,
	t,
}: AssistantClearChatModalProps): React.ReactElement | null {
	if (!open) return null;

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onDismiss}
			zIndex={modalZIndex}
			dismissAriaLabel={t('clearChatModalCancel')}
		>
			<DesktopAppModalFrame
				title={t('clearChatModalTitle')}
				onClose={onDismiss}
				closeLabel={t('clearChatModalCancel')}
				className="max-w-md border-l-[3px] border-l-rose-400/65 shadow-lg shadow-black/20"
				role="alertdialog"
				aria-describedby={descId}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex flex-col gap-4 p-4">
					<div className="flex items-start gap-3">
						<div
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.emptyIcon,
								'h-11! w-11! shrink-0 border-rose-500/25 bg-rose-500/10'
							)}
						>
							<TrashIcon className="h-5 w-5 text-rose-300/90" aria-hidden />
						</div>
						<p
							id={descId}
							className={cn(DESKTOP_TYPOGRAPHY.body, 'leading-relaxed')}
						>
							{t('clearChatConfirm')}
						</p>
					</div>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('clearChatConfirm')}
					</p>
					<div className="flex flex-wrap justify-end gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onDismiss}
						>
							{t('clearChatModalCancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="danger"
							size="sm"
							className={cn(
								!clearing && ASSISTANT_CLEAR_MODAL_CONFIRM_PULSE_CLASS
							)}
							disabled={clearing}
							onClick={onConfirm}
						>
							{clearing ? (
								<ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden />
							) : null}
							{t('clearChatModalConfirm')}
						</DesktopAppButton>
					</div>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
}
