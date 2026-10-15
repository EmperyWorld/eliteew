/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Destructive confirmation modal before clearing all notifications in the hub.
 *
 * Invariants:
 * - Uses alertdialog semantics; body text linked via aria-describedby.
 * - Portaled confirm uses `DesktopPortaledConfirmShell` (shell theme portal + z-index).
 *
 * Related:
 * - NotificationHubBody.tsx, notificationHubLayoutTokens.ts
 * - DesktopChromeTooltip.tsx, DesktopWindowPortalStackContext.tsx
 */

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '../../context/DesktopWindowPortalStackContext';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { useId, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	NH_CLEAR_CONFIRM_ACTIONS_CLASS,
	NH_CLEAR_CONFIRM_BODY_TEXT_CLASS,
	NH_CLEAR_CONFIRM_BODY_WRAP_CLASS,
	NH_CLEAR_CONFIRM_MODAL_CLASS,
} from './notificationHubLayoutTokens';

export const NotificationHubClearConfirm: FC<{
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
}> = ({ open, onClose, onConfirm }) => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
	const descId = useId();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	if (!open) {
		return null;
	}

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={embeddedModalZ}
			dismissAriaLabel={t('clearAllConfirmCancel')}
		>
			<DesktopAppModalFrame
				title={t('clearAllConfirmTitle')}
				onClose={onClose}
				className={NH_CLEAR_CONFIRM_MODAL_CLASS}
				role="alertdialog"
				aria-describedby={descId}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={NH_CLEAR_CONFIRM_BODY_WRAP_CLASS}>
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
						<p id={descId} className={NH_CLEAR_CONFIRM_BODY_TEXT_CLASS}>
							{t('clearAllConfirmBody')}
						</p>
					</div>
					<div className={NH_CLEAR_CONFIRM_ACTIONS_CLASS}>
						<DesktopChromeTooltip
							content={t('clearAllConfirmCancel')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={onClose}
							>
								{t('clearAllConfirmCancel')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('clearAllConfirmDestructive')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="danger"
								size="sm"
								aria-label={t('clearAllConfirmDestructiveAria')}
								onClick={() => {
									onConfirm();
									onClose();
								}}
							>
								{t('clearAllConfirmDestructive')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</div>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
};
