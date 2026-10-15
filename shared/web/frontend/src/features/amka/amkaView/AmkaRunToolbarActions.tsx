/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run detail toolbar actions: approve, continue, export, resume, cancel.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewMutations.ts
 */

import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	PauseCircleIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import type { AmkaRun } from '@/services/amka/marketingCabinetAmkaBridge';
import { AMKA_RUN_TERMINAL } from '@/features/amka/amkaViewUtils';

type ActionableState = {
	canApprove: boolean;
	canContinueStep: boolean;
	canResume: boolean;
	canCancel: boolean;
};

type AmkaRunToolbarActionsProps = {
	selectedRun: AmkaRun;
	actionableState: ActionableState;
	busy: boolean;
	formCheckboxClass: string;
	exportIncludeCoreAlignment: boolean;
	onExportIncludeCoreAlignmentChange: (value: boolean) => void;
	failedStepIndex: number | null;
	stepPageSafeIndex: number;
	onGoToFailedStep: () => void;
	onApprove: () => void;
	onContinueStep: () => void;
	onExportReport: () => void;
	onResume: () => void;
	onCancel: () => void;
};

export function AmkaRunToolbarActions({
	selectedRun,
	actionableState,
	busy,
	formCheckboxClass,
	exportIncludeCoreAlignment,
	onExportIncludeCoreAlignmentChange,
	failedStepIndex,
	stepPageSafeIndex,
	onGoToFailedStep,
	onApprove,
	onContinueStep,
	onExportReport,
	onResume,
	onCancel,
}: AmkaRunToolbarActionsProps) {
	const { t } = useTranslation('marketing');

	return (
		<div className="flex flex-wrap gap-2">
			{actionableState.canApprove ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="accent"
					className="gap-1.5"
					disabled={busy}
					onClick={onApprove}
				>
					<PlayIcon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
					{t('amkaView.approveButton')}
				</DesktopAppButton>
			) : null}
			{actionableState.canContinueStep ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="accent"
					className="gap-1.5"
					disabled={busy}
					onClick={onContinueStep}
				>
					<PlayIcon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
					{t('amkaView.continueStepButton')}
				</DesktopAppButton>
			) : null}
			{AMKA_RUN_TERMINAL.has(selectedRun.status) ? (
				<div className="flex flex-col items-stretch gap-1.5 sm:items-end">
					<label className="flex cursor-pointer items-center justify-end gap-2 text-[11px] text-(--desktop-text-muted)">
						<input
							type="checkbox"
							className={formCheckboxClass}
							checked={exportIncludeCoreAlignment}
							onChange={(e) =>
								onExportIncludeCoreAlignmentChange(e.target.checked)
							}
						/>
						<span className="wrap-pretty text-left sm:text-right">
							{t('amkaView.exportIncludeCoreAlignment')}
						</span>
					</label>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="gap-1.5"
						disabled={busy}
						onClick={onExportReport}
					>
						<ArrowDownTrayIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('amkaView.exportReportButton')}
					</DesktopAppButton>
				</div>
			) : null}
			{actionableState.canResume ? (
				<>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="gap-1.5"
						disabled={busy}
						onClick={onResume}
					>
						<ArrowPathIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						{t('amkaView.resumeButton')}
					</DesktopAppButton>
					{failedStepIndex !== null && stepPageSafeIndex !== failedStepIndex ? (
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="gap-1.5"
							disabled={busy}
							onClick={onGoToFailedStep}
						>
							{t('amkaView.goToFailedStepButton')}
						</DesktopAppButton>
					) : null}
				</>
			) : null}
			{actionableState.canCancel ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className="gap-1.5"
					disabled={busy}
					onClick={onCancel}
				>
					<PauseCircleIcon
						className="h-4 w-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					{t('amkaView.cancelButton')}
				</DesktopAppButton>
			) : null}
		</div>
	);
}
