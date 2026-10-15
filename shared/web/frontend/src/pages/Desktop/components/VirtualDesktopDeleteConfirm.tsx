/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Destructive confirm before removing a virtual desktop (P4 semantic contract).
 *
 * Invariants:
 * - Never calls delete until explicit confirm; cancel restores prior focus via shell portal.
 *
 * Related:
 * - VirtualDesktops.tsx, VirtualDesktopsCompactMenu.tsx
 * - shell/shellSemanticContracts.ts
 */

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useId, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from './DesktopAppChrome';

export const VirtualDesktopDeleteConfirm: FC<{
	open: boolean;
	desktopLabel: string;
	zIndex: number;
	onClose: () => void;
	onConfirm: () => void;
}> = ({ open, desktopLabel, zIndex, onClose, onConfirm }) => {
	const { t } = useTranslation('desktopUi');
	const descId = useId();

	if (!open) {
		return null;
	}

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={zIndex}
			dismissAriaLabel={t('virtualDesktops.deleteConfirmCancel')}
		>
			<DesktopAppModalFrame
				title={t('virtualDesktops.deleteConfirmTitle')}
				onClose={onClose}
				className="max-w-md"
				role="alertdialog"
				aria-describedby={descId}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex flex-col gap-4 p-1">
					<div className="flex items-start gap-3">
						<div
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.emptyIcon,
								'h-11! w-11! shrink-0 border-rose-500/25 bg-rose-500/10'
							)}
						>
							<ExclamationTriangleIcon
								className="h-5 w-5 text-rose-300/90"
								aria-hidden
							/>
						</div>
						<p
							id={descId}
							className="text-sm leading-relaxed text-(--desktop-text-secondary)"
						>
							{t('virtualDesktops.deleteConfirmBody', {
								name: desktopLabel,
							})}
						</p>
					</div>
					<div className="flex justify-end gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onClose}
						>
							{t('virtualDesktops.deleteConfirmCancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="danger"
							size="sm"
							onClick={onConfirm}
							data-testid="virtual-desktop-delete-confirm"
						>
							{t('virtualDesktops.deleteConfirmDestructive')}
						</DesktopAppButton>
					</div>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
};
