/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portaled confirm when user exits survey runner with partial answers.
 *
 * Invariants:
 * - Mounts via DesktopPortaledConfirmShell → useShellPortal (no createPortal(document.body)).
 *
 * Related:
 * - SurveyRunner.tsx · surveyHubLayoutTokens.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (U3.1-B)
 */
import { cn } from '@/utils/cn';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useId, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
	SH_RUNNER_EXIT_CONFIRM_ACTIONS_CLASS,
	SH_RUNNER_EXIT_CONFIRM_MODAL_CLASS,
} from './surveyHubLayoutTokens';

type Props = {
	open: boolean;
	answeredCount: number;
	onClose: () => void;
	onConfirmExit: () => void;
};

export function SurveyRunnerExitConfirm({
	open,
	answeredCount,
	onClose,
	onConfirmExit,
}: Props): ReactElement | null {
	const { t } = useTranslation('surveys');
	const descId = useId();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	if (!open || typeof document === 'undefined') {
		return null;
	}

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={embeddedModalZ}
			dismissAriaLabel={t('runner.exitConfirm.stay')}
		>
			<DesktopAppModalFrame
				title={t('runner.exitConfirm.title')}
				onClose={onClose}
				className={SH_RUNNER_EXIT_CONFIRM_MODAL_CLASS}
				role="alertdialog"
				aria-describedby={descId}
				onClick={(event) => event.stopPropagation()}
			>
				<p
					id={descId}
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'px-4 pb-1 text-(--desktop-text-secondary)'
					)}
				>
					{t('runner.exitConfirm.body', { count: answeredCount })}{' '}
					{t('runner.exitConfirm.sessionNote')}
				</p>
				<div className={cn(SH_RUNNER_EXIT_CONFIRM_ACTIONS_CLASS, 'px-4 pb-4')}>
					<DesktopAppButton type="button" variant="neutral" onClick={onClose}>
						{t('runner.exitConfirm.stay')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="danger"
						onClick={() => {
							onConfirmExit();
							onClose();
						}}
					>
						{t('runner.exitConfirm.leave')}
					</DesktopAppButton>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
}
