/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Accessible desktop-styled modal for SSO session-replace confirmation (replaces window.confirm).
 *
 * Invariants:
 * - Focus trap via initial focus on cancel; Escape closes as cancel when not resolving.
 *
 * Related:
 * - services/auth/ssoSessionReplaceConfirm.ts, pages/Desktop/components/Taskbar.tsx (logout confirm)
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, m } from 'framer-motion';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { getDesktopShellPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { peekSessionReplaceXorPartner } from '@/services/auth/ssoSessionReplaceConfirm';
import { cn } from '@/utils/cn';

export type SsoSessionReplaceConfirmDialogProps = {
	open: boolean;
	resolving?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export function SsoSessionReplaceConfirmDialog({
	open,
	resolving = false,
	onConfirm,
	onCancel,
}: SsoSessionReplaceConfirmDialogProps) {
	const { t } = useTranslation('desktopUi');
	const cancelRef = useRef<HTMLButtonElement>(null);
	const titleId = 'sso-session-replace-title';
	const bodyId = 'sso-session-replace-body';
	const shellPanelStrong = getDesktopShellPanelClassName('glass', 'strong');
	const xorPartner = peekSessionReplaceXorPartner();
	const bodyKey =
		xorPartner === 'browser'
			? 'sessionAuth.sessionReplaceBodyFoflineWins'
			: xorPartner === 'fofline'
				? 'sessionAuth.sessionReplaceBodyBrowserWins'
				: 'sessionAuth.sessionReplaceBody';

	useEffect(() => {
		if (!open || resolving) return;
		cancelRef.current?.focus();
	}, [open, resolving]);

	useEffect(() => {
		if (!open || resolving) return;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onCancel();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return (): void => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [open, resolving, onCancel]);

	return (
		<AnimatePresence>
			{open ? (
				<m.div
					className={`fixed inset-0 flex items-center justify-center ${DESKTOP_OVERLAY.backdrop}`}
					style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={() => {
						if (!resolving) onCancel();
					}}
					data-testid="sso-session-replace-dialog"
				>
					<m.div
						className={cn(shellPanelStrong, 'max-w-md w-full mx-4 p-5')}
						style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}
						initial={{ scale: 0.94, opacity: 0, y: 12 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.94, opacity: 0, y: 12 }}
						transition={{ type: 'spring', stiffness: 260, damping: 24 }}
						onClick={(event) => event.stopPropagation()}
						role="alertdialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={bodyId}
					>
						<div className="flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-100">
								<ExclamationTriangleIcon
									className={DESKTOP_LUCIDE.lg}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</div>
							<div className="min-w-0">
								<h2 id={titleId} className={DESKTOP_TYPOGRAPHY.subtitle}>
									{t('sessionAuth.sessionReplaceTitle')}
								</h2>
								<p id={bodyId} className={cn(DESKTOP_TYPOGRAPHY.body, 'mt-1')}>
									{t(bodyKey)}
								</p>
							</div>
						</div>
						<div className="mt-5 flex justify-end gap-2">
							<DesktopAppButton
								ref={cancelRef}
								type="button"
								onClick={onCancel}
								disabled={resolving}
								variant="neutral"
								size="md"
							>
								{t('sessionAuth.sessionReplaceCancel')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								onClick={onConfirm}
								disabled={resolving}
								variant="accent"
								size="md"
								className="disabled:cursor-wait"
							>
								{t('sessionAuth.sessionReplaceConfirm')}
							</DesktopAppButton>
						</div>
					</m.div>
				</m.div>
			) : null}
		</AnimatePresence>
	);
}
