/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Two-step wizard to duplicate a builtin ensemble plan template into DB drafts.
 *
 * Invariants:
 * - Parent owns selectedBuiltinId / submit; this is presentation + step chrome.
 *
 * Related:
 * - pages/Admin/desktopAiChat/EnsemblePlanWorkbench.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopAiDialogFocusTrap } from '../../../../features/desktop-ai-chat/useDesktopAiDialogFocusTrap';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';

export type DuplicateWizardStep = 'pick' | 'details';

export type EnsemblePlanBuiltinOption = {
	id: string;
	title: string;
	keywords?: string[] | null;
	example_command?: string | null;
};

export type EnsemblePlanDuplicateWizardProps = {
	busy: boolean;
	step: DuplicateWizardStep;
	onStepChange: (step: DuplicateWizardStep) => void;
	builtins: EnsemblePlanBuiltinOption[];
	selectedBuiltinId: string;
	onSelectedBuiltinIdChange: (id: string) => void;
	newTemplateId: string;
	onNewTemplateIdChange: (value: string) => void;
	title: string;
	onTitleChange: (value: string) => void;
	onSubmit: () => void;
	onClose: () => void;
};

export function EnsemblePlanDuplicateWizard({
	busy,
	step,
	onStepChange,
	builtins,
	selectedBuiltinId,
	onSelectedBuiltinIdChange,
	newTemplateId,
	onNewTemplateIdChange,
	title,
	onTitleChange,
	onSubmit,
	onClose,
}: EnsemblePlanDuplicateWizardProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const dupDialogRef = React.useRef<HTMLDivElement>(null);
	useDesktopAiDialogFocusTrap(dupDialogRef, true);
	const selectedBuiltin = builtins.find((b) => b.id === selectedBuiltinId);

	return (
		<div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-black/60"
				aria-label={t('adminEnsemblePlan.duplicateWizardCancel')}
				onClick={onClose}
			/>
			<div
				ref={dupDialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="dac-dup-wizard-title"
				tabIndex={-1}
				className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0520] p-5 shadow-2xl outline-none"
			>
				<h3
					id="dac-dup-wizard-title"
					className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}
				>
					{t('adminEnsemblePlan.duplicateWizardTitle')}
				</h3>
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-white/55`}>
					{t('adminEnsemblePlan.duplicateWizardLead')}
				</p>
				<div className="mt-4 space-y-3">
					{step === 'pick' ? (
						<label className="flex flex-col gap-1">
							<span className="text-white/50 text-xs">
								{t('adminEnsemblePlan.source')}
							</span>
							<select
								className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
								value={selectedBuiltinId}
								onChange={(e) => onSelectedBuiltinIdChange(e.target.value)}
							>
								{builtins.map((b) => (
									<option key={b.id} value={b.id}>
										{b.title} ({b.id})
									</option>
								))}
							</select>
						</label>
					) : (
						<>
							<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/70`}>
								{t('adminEnsemblePlan.duplicateWizardSource', {
									id: selectedBuiltin?.title ?? selectedBuiltinId,
								})}
							</p>
							{selectedBuiltin ? (
								<div className="rounded border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/65">
									{(selectedBuiltin.keywords ?? []).length > 0 ? (
										<p>
											{t('adminEnsemblePlan.keywordsPreview', {
												keywords: (selectedBuiltin.keywords ?? []).join(', '),
											})}
										</p>
									) : null}
									{(selectedBuiltin.example_command ?? '').trim() ? (
										<p className="mt-1">
											{t('adminEnsemblePlan.exampleRequest')}{' '}
											<code className="text-violet-200/90">
												{selectedBuiltin.example_command}
											</code>
										</p>
									) : null}
								</div>
							) : null}
							<label className="flex flex-col gap-1">
								<span className="text-white/50 text-xs">
									{t('adminEnsemblePlan.newTemplateIdCopy')}
								</span>
								<input
									className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
									value={newTemplateId}
									onChange={(e) => onNewTemplateIdChange(e.target.value)}
									placeholder={t('adminEnsemblePlan.templateIdPlaceholder')}
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-white/50 text-xs">
									{t('adminEnsemblePlan.titleOptional')}
								</span>
								<input
									className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
									value={title}
									onChange={(e) => onTitleChange(e.target.value)}
								/>
							</label>
						</>
					)}
				</div>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
					>
						{t('adminEnsemblePlan.duplicateWizardCancel')}
					</button>
					{step === 'pick' ? (
						<button
							type="button"
							onClick={() => onStepChange('details')}
							disabled={!selectedBuiltinId}
							className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white disabled:opacity-50"
						>
							{t('adminEnsemblePlan.duplicateWizardNext')}
						</button>
					) : (
						<button
							type="button"
							onClick={onSubmit}
							disabled={busy}
							className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white disabled:opacity-50"
						>
							{busy
								? t('adminAiChat.saving')
								: t('adminEnsemblePlan.duplicateToDb')}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
