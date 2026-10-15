/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat confirm dialog for clear/archive/delete actions.
 *
 * Invariants:
 * - Rendered only when `kind` is set; closes after confirm.
 *
 * Related:
 * - GAFChatApp.tsx, DesktopChromeTooltip.tsx
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DesktopAppButton, DesktopAppModalFrame } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export type GAFChatConfirmKind =
	| 'clear'
	| 'archive'
	| 'delete'
	| 'deleteMessageMe'
	| 'deleteMessageEveryone';

export interface GAFChatConfirmModalProps {
	kind: GAFChatConfirmKind | null;
	onClose: () => void;
	onConfirm: () => void;
}

export function GAFChatConfirmModal({
	kind,
	onClose,
	onConfirm,
}: GAFChatConfirmModalProps) {
	const { t } = useTranslation('gafChat');
	const descId = useId();
	if (!kind) return null;

	const body =
		kind === 'clear'
			? t('confirmClearHistory')
			: kind === 'archive'
				? t('confirmArchive')
				: kind === 'delete'
					? t('confirmDeleteBoth')
					: kind === 'deleteMessageMe'
						? t('confirmDeleteMessageMeBody')
						: kind === 'deleteMessageEveryone'
							? t('confirmDeleteMessageEveryoneBody')
							: t('confirmDeleteBoth');
	const title =
		kind === 'clear'
			? t('confirmModalTitleClear')
			: kind === 'archive'
				? t('confirmModalTitleArchive')
				: kind === 'delete'
					? t('confirmModalTitleDelete')
					: kind === 'deleteMessageMe'
						? t('confirmDeleteMessageMeTitle')
						: kind === 'deleteMessageEveryone'
							? t('confirmDeleteMessageEveryoneTitle')
							: t('confirmModalTitleDelete');
	const isDanger = kind === 'delete' || kind === 'deleteMessageEveryone';
	const cancelLabel = t('confirmModalCancel');
	const confirmLabel = isDanger
		? t('confirmModalConfirmDanger')
		: t('confirmModalConfirm');

	return (
		<DesktopAppModalFrame
			title={title}
			onClose={onClose}
			className="max-w-md"
			role="alertdialog"
			aria-describedby={descId}
			onClick={(e) => e.stopPropagation()}
		>
			<div className="flex flex-col gap-4 p-4">
				<p
					id={descId}
					className={cn(DESKTOP_TYPOGRAPHY.bodyMuted, 'leading-relaxed')}
				>
					{body}
				</p>
				<div className="flex flex-wrap justify-end gap-2">
					<DesktopChromeTooltip
						content={cancelLabel}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onClose}
						>
							{cancelLabel}
						</DesktopAppButton>
					</DesktopChromeTooltip>
					<DesktopChromeTooltip
						content={confirmLabel}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant={isDanger ? 'danger' : 'accent'}
							size="sm"
							onClick={() => {
								onConfirm();
								onClose();
							}}
						>
							{confirmLabel}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			</div>
		</DesktopAppModalFrame>
	);
}
