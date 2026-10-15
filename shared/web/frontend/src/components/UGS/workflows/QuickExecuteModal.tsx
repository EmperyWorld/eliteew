/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick-launch modal for DB-first UGS workflows (prompt, dimensions, seed).
 *
 * Invariants:
 * - User-visible labels use `ugsHub.workflows.quick*` keys.
 *
 * Related:
 * - UGSWorkflowsTab.tsx, ugsHubSharedUi.tsx, ugsWorkflowsSharedUi.ts
 */

import * as React from 'react';
import { PlayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '../../../utils/cn';
import {
	UgsHubModalFrame,
	ugsHubHeaderBtnClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '../hub/ugsHubSharedUi';
import { useUgsHubShellTheme } from '../hub/ugsHubShellThemeContext';
import type { QuickExecuteFormState, WorkflowRecord } from './types';
import {
	workflowsFieldClasses,
	workflowsFieldLabelClasses,
	workflowsModalErrorClasses,
	workflowQuickExecuteSubmitBtnClasses,
} from './ugsWorkflowsSharedUi';

interface QuickExecuteModalProps {
	workflow: WorkflowRecord | null;
	form: QuickExecuteFormState;
	error: string | null;
	submitting: boolean;
	onClose: () => void;
	onSubmit: () => void;
	onChange: (patch: Partial<QuickExecuteFormState>) => void;
}

const QuickExecuteModal: React.FC<QuickExecuteModalProps> = ({
	workflow,
	form,
	error,
	submitting,
	onClose,
	onSubmit,
	onChange,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const btn = ugsHubHeaderBtnClasses(theme);

	if (!workflow) {
		return null;
	}

	const handleClose = (): void => {
		if (!submitting) {
			onClose();
		}
	};

	return (
		<UgsHubModalFrame
			backdropZ={embeddedModalZ.backdrop}
			contentZ={embeddedModalZ.content}
			onClose={handleClose}
			maxWidthClass="max-w-[96vw] xl:max-w-4xl"
			maxHeightClass="max-h-[min(90vh,760px)]"
			header={
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 pr-2">
						<h4
							id="ugs-quick-exec-title"
							className={cn('text-xl font-semibold', ugsHubTextPrimary(theme))}
						>
							{t('workflows.quickTitle', { name: workflow.workflow_name })}
						</h4>
						<p className={cn('mt-2 text-sm', ugsHubTextSecondary(theme))}>
							{t('workflows.quickSubtitle')}
						</p>
					</div>
					<button
						type="button"
						onClick={handleClose}
						disabled={submitting}
						aria-label={t('workflows.quickCloseAria')}
						className={cn(
							btn,
							'shrink-0 disabled:cursor-not-allowed disabled:opacity-60'
						)}
					>
						{t('workflows.quickClose')}
					</button>
				</div>
			}
			footer={
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className={cn('max-w-prose text-xs', ugsHubTextMuted(theme))}>
						{t('workflows.quickFooterHint')}
					</p>
					<div className="flex shrink-0 items-center gap-3">
						<button
							type="button"
							onClick={handleClose}
							disabled={submitting}
							aria-label={t('workflows.quickCancelAria')}
							className={cn(
								btn,
								'disabled:cursor-not-allowed disabled:opacity-60'
							)}
						>
							{t('workflows.quickCancel')}
						</button>
						<button
							type="button"
							onClick={onSubmit}
							disabled={submitting}
							aria-label={
								submitting
									? t('workflows.quickSubmitAriaSubmitting')
									: t('workflows.quickSubmitAria', {
											name: workflow.workflow_name,
										})
							}
							className={workflowQuickExecuteSubmitBtnClasses()}
						>
							<PlayIcon width={14} height={14} aria-hidden />
							{submitting
								? t('workflows.quickSubmitting')
								: t('workflows.quickSubmit')}
						</button>
					</div>
				</div>
			}
		>
			<div className="space-y-4">
				{error ? (
					<div role="alert" className={workflowsModalErrorClasses(theme)}>
						{error}
					</div>
				) : null}

				<div>
					<label
						className={workflowsFieldLabelClasses(theme)}
						htmlFor="ugs-qe-prompt"
					>
						{t('workflows.quickPromptLabel')}
					</label>
					<textarea
						id="ugs-qe-prompt"
						value={form.prompt}
						onChange={(event) => onChange({ prompt: event.target.value })}
						placeholder={t('workflows.quickPromptPlaceholder')}
						rows={5}
						className={workflowsFieldClasses(theme)}
					/>
				</div>

				<div>
					<label
						className={workflowsFieldLabelClasses(theme)}
						htmlFor="ugs-qe-negative"
					>
						{t('workflows.quickNegativeLabel')}
					</label>
					<textarea
						id="ugs-qe-negative"
						value={form.negative_prompt}
						onChange={(event) =>
							onChange({ negative_prompt: event.target.value })
						}
						placeholder={t('workflows.quickNegativePlaceholder')}
						rows={3}
						className={workflowsFieldClasses(theme)}
					/>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
					<div>
						<label
							className={workflowsFieldLabelClasses(theme)}
							htmlFor="ugs-qe-width"
						>
							{t('workflows.quickWidthLabel')}
						</label>
						<input
							id="ugs-qe-width"
							value={form.width}
							onChange={(event) => onChange({ width: event.target.value })}
							inputMode="numeric"
							className={workflowsFieldClasses(theme)}
						/>
					</div>
					<div>
						<label
							className={workflowsFieldLabelClasses(theme)}
							htmlFor="ugs-qe-height"
						>
							{t('workflows.quickHeightLabel')}
						</label>
						<input
							id="ugs-qe-height"
							value={form.height}
							onChange={(event) => onChange({ height: event.target.value })}
							inputMode="numeric"
							className={workflowsFieldClasses(theme)}
						/>
					</div>
					<div>
						<label
							className={workflowsFieldLabelClasses(theme)}
							htmlFor="ugs-qe-seed"
						>
							{t('workflows.quickSeedLabel')}
						</label>
						<input
							id="ugs-qe-seed"
							value={form.seed}
							onChange={(event) => onChange({ seed: event.target.value })}
							inputMode="numeric"
							placeholder={t('workflows.quickSeedPlaceholder')}
							className={workflowsFieldClasses(theme)}
						/>
					</div>
				</div>
			</div>
		</UgsHubModalFrame>
	);
};

export default QuickExecuteModal;
