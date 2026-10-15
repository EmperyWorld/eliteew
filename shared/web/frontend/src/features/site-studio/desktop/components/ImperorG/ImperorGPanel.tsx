/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing Site Studio auto-fill panel for launching, tracking, and applying generated site drafts.
 *
 * Invariants:
 * - Primary copy uses product wording; internal ImperorG names stay out of normal user labels.
 * - Apply actions remain explicit and never mutate runtime content automatically after generation.
 *
 * Related:
 * - ../../api-imperorg.ts
 * - ./imperorGPipelineRunner.ts
 */
import { Textarea } from '@components/atoms/Textarea';
import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ImperorGConfig } from '../../api-imperorg';
import { ContentStudioPicker } from './ContentStudioPicker';
import { ImperorGRoadmap } from './ImperorGRoadmap';
import { useImperorG } from './useImperorG';
import {
	ArrowPathIcon,
	CheckIcon,
	ExclamationTriangleIcon,
	MusicalNoteIcon,
	PlayIcon,
	RocketLaunchIcon,
	StarIcon,
	StopCircleIcon,
} from '@heroicons/react/24/outline';

interface ImperorGPanelProps {
	onComplete?: () => void;
	onApplyAll?: () => Promise<void>;
	onApplyAndLaunch?: () => Promise<void>;
}

function readNumericField(source: unknown, key: string): number {
	if (typeof source !== 'object' || source === null) return 0;
	const value = (source as Record<string, unknown>)[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readApplyReportSummary(summary: Record<string, unknown> | null): {
	applied: number;
	skipped: number;
	failed: number;
	retried: number;
	qualityFindings: number;
} | null {
	const report = summary?.apply_report;
	if (typeof report !== 'object' || report === null) return null;
	return {
		applied: readNumericField(report, 'applied'),
		skipped: readNumericField(report, 'skipped'),
		failed: readNumericField(report, 'failed'),
		retried: readNumericField(report, 'retried'),
		qualityFindings: readNumericField(report, 'quality_findings'),
	};
}

export const ImperorGPanel: React.FC<ImperorGPanelProps> = ({
	onComplete,
	onApplyAll,
	onApplyAndLaunch,
}) => {
	const { t } = useTranslation('siteStudio');
	const [userPrompt, setUserPrompt] = useState('');
	const [documentId, setDocumentId] = useState<string | null>(null);
	const [includeAudio, setIncludeAudio] = useState(false);
	const [useWebSearch, setUseWebSearch] = useState(false);
	const [applyBusy, setApplyBusy] = useState(false);
	const [applyDone, setApplyDone] = useState<string | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const {
		status,
		phases,
		currentPhaseIndex,
		errorMessage,
		errorMessageKey,
		pipelineSummary,
		isLeader,
		recoveryHint,
		recoveryHintKey,
		launch,
		cancel,
		dismissInterrupted,
	} = useImperorG(onComplete);

	const isRunning = status === 'running';
	const isIdle = status === 'idle';
	const isComplete = status === 'complete';
	const isError = status === 'error';
	const isInterrupted = status === 'interrupted';
	const applyReportSummary = readApplyReportSummary(pipelineSummary);
	const displayErrorMessage = errorMessageKey
		? t(errorMessageKey)
		: errorMessage;
	const recoveryHintMessage = recoveryHintKey
		? t(recoveryHintKey)
		: recoveryHint;

	const handleLaunch = useCallback(() => {
		const config: ImperorGConfig = {
			user_prompt: userPrompt.trim() || null,
			document_id: documentId,
			include_audio: includeAudio,
			use_web_search: useWebSearch,
		};
		launch(config);
		setApplyDone(null);
		setApplyError(null);
	}, [userPrompt, documentId, includeAudio, useWebSearch, launch]);

	const handleApply = useCallback(
		async (withLaunch: boolean) => {
			const fn = withLaunch ? onApplyAndLaunch : onApplyAll;
			if (!fn) return;
			setApplyBusy(true);
			setApplyError(null);
			setApplyDone(null);
			try {
				await fn();
				setApplyDone(withLaunch ? 'applied-launched' : 'applied');
			} catch (err: unknown) {
				setApplyError(err instanceof Error ? err.message : String(err));
			} finally {
				setApplyBusy(false);
			}
		},
		[onApplyAll, onApplyAndLaunch]
	);

	return (
		<div className="flex min-h-0 w-full flex-col gap-4 overflow-x-hidden px-0.5 pb-6 sm:px-1">
			{/* Header */}
			<DesktopAppPanel className="flex flex-col gap-3 p-4">
				<div className="flex items-center gap-2">
					<StarIcon className="h-5 w-5 text-amber-400" />
					<DesktopAppSectionLabel>
						{t('autofill.panelTitle')}
					</DesktopAppSectionLabel>
				</div>
				<p className="text-xs leading-5 text-(--desktop-text-secondary)">
					{t('autofill.panelDescription')}
				</p>
			</DesktopAppPanel>

			{isInterrupted && recoveryHintMessage && (
				<DesktopAppPanel className="flex flex-col gap-3 border-amber-500/30 bg-amber-500/5 p-4">
					<div className="flex items-start gap-2">
						<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
						<p className="text-xs leading-5 text-(--desktop-text-secondary)">
							{recoveryHintMessage}
						</p>
					</div>
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={dismissInterrupted}
					>
						{t('autofill.dismissInterrupted')}
					</DesktopAppButton>
				</DesktopAppPanel>
			)}

			{/* Launch form (only when idle or error) */}
			{(isIdle || isError) && (
				<DesktopAppPanel className="flex flex-col gap-4 p-4">
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1">
							<label
								htmlFor="imperorg-project-description"
								className="text-xs font-medium text-(--desktop-text-secondary)"
							>
								{t('autofill.projectDescriptionLabel')}
							</label>
							<Textarea
								id="imperorg-project-description"
								value={userPrompt}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
									setUserPrompt(e.target.value)
								}
								placeholder={t('autofill.projectDescriptionPlaceholder')}
								className="min-h-[80px] resize-y rounded-lg border border-(--desktop-border-secondary) bg-(--desktop-bg-secondary) px-3 py-2 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-tertiary) focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
								maxLength={8000}
							/>
						</div>

						<ContentStudioPicker value={documentId} onChange={setDocumentId} />

						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={includeAudio}
								onChange={(e) => setIncludeAudio(e.target.checked)}
								className="h-3.5 w-3.5 rounded border-(--desktop-border-secondary) bg-(--desktop-bg-secondary) text-amber-500 focus:ring-amber-500/30"
							/>
							<MusicalNoteIcon className="h-3.5 w-3.5 text-(--desktop-text-tertiary)" />
							<span className="text-xs text-(--desktop-text-secondary)">
								{t('autofill.audioIdentity')}
							</span>
						</label>

						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={useWebSearch}
								onChange={(e) => setUseWebSearch(e.target.checked)}
								className="h-3.5 w-3.5 rounded border-(--desktop-border-secondary) bg-(--desktop-bg-secondary) text-amber-500 focus:ring-amber-500/30"
							/>
							<span className="text-xs text-(--desktop-text-secondary)">
								{t('autofill.webSearch')}
							</span>
						</label>
					</div>

					{isError && displayErrorMessage && (
						<div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
							<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
							<p className="text-xs text-red-300">{displayErrorMessage}</p>
						</div>
					)}

					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={handleLaunch}
					>
						<StarIcon className="h-4 w-4" />
						{t('autofill.launchButton')}
					</DesktopAppButton>
				</DesktopAppPanel>
			)}

			{/* Running / complete state */}
			{(isRunning || isComplete) && (
				<DesktopAppPanel className="flex flex-col gap-4 p-4">
					{isRunning && !isLeader && (
						<p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/90">
							{t('autofill.otherTabRunning')}
						</p>
					)}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{isRunning && (
								<ArrowPathIcon className="h-4 w-4 animate-spin text-amber-400 motion-reduce:animate-none" />
							)}
							<span className="text-sm font-medium text-(--desktop-text-primary)">
								{isRunning
									? t('autofill.runningStatus')
									: t('autofill.completeStatus')}
							</span>
						</div>
						{isRunning && isLeader && (
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={cancel}
							>
								<StopCircleIcon className="h-4 w-4" />
								{t('autofill.cancelButton')}
							</DesktopAppButton>
						)}
					</div>

					<ImperorGRoadmap
						phases={phases}
						currentPhaseIndex={currentPhaseIndex}
					/>

					{isComplete && pipelineSummary && (
						<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
							<p className="text-xs text-emerald-300">
								{t('autofill.summaryPrefix')}{' '}
								{String(
									pipelineSummary.summary || t('autofill.summaryFallback')
								)}
							</p>
						</div>
					)}

					{isComplete && (
						<DesktopAppSurface
							variant="soft"
							padding="sm"
							className="border border-amber-400/20 bg-amber-500/5"
						>
							<div className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
								{t('autofill.applyPreviewTitle')}
							</div>
							<p className="mt-2 text-xs leading-5 text-(--desktop-text-secondary)">
								{t('autofill.applyPreviewDescription')}
							</p>
							{applyReportSummary ? (
								<div className="mt-3 grid gap-2 text-xs text-(--desktop-text-secondary) sm:grid-cols-5">
									<div>
										<span className="text-(--desktop-text-dim)">
											{t('autofill.applyPreviewApplied')}
										</span>
										<div className="font-medium text-emerald-100">
											{applyReportSummary.applied}
										</div>
									</div>
									<div>
										<span className="text-(--desktop-text-dim)">
											{t('autofill.applyPreviewSkipped')}
										</span>
										<div className="font-medium text-amber-100">
											{applyReportSummary.skipped}
										</div>
									</div>
									<div>
										<span className="text-(--desktop-text-dim)">
											{t('autofill.applyPreviewFailed')}
										</span>
										<div className="font-medium text-red-100">
											{applyReportSummary.failed}
										</div>
									</div>
									<div>
										<span className="text-(--desktop-text-dim)">
											{t('autofill.applyPreviewRetried')}
										</span>
										<div className="font-medium text-sky-100">
											{applyReportSummary.retried}
										</div>
									</div>
									<div>
										<span className="text-(--desktop-text-dim)">
											{t('autofill.applyPreviewQuality')}
										</span>
										<div className="font-medium text-(--desktop-text-primary)">
											{applyReportSummary.qualityFindings}
										</div>
									</div>
								</div>
							) : null}
						</DesktopAppSurface>
					)}

					{isComplete && applyError && (
						<div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
							<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
							<p className="text-xs text-red-300">{applyError}</p>
						</div>
					)}

					{isComplete && applyDone && (
						<div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
							<CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
							<p className="text-xs text-emerald-300">
								{applyDone === 'applied-launched'
									? t('autofill.applyLaunchDone')
									: t('autofill.applyDone')}
							</p>
						</div>
					)}

					{isComplete && (
						<div className="flex flex-col gap-2">
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={applyBusy || !onApplyAll}
									onClick={() => handleApply(false)}
								>
									{applyBusy ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />
									) : (
										<PlayIcon className="h-4 w-4" />
									)}
									{t('autofill.applyAllButton')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={applyBusy || !onApplyAndLaunch}
									onClick={() => handleApply(true)}
								>
									{applyBusy ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />
									) : (
										<RocketLaunchIcon className="h-4 w-4" />
									)}
									{t('autofill.applyAndLaunchButton')}
								</DesktopAppButton>
							</div>
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={() => {
									cancel();
									setApplyDone(null);
									setApplyError(null);
								}}
							>
								{t('autofill.newRunButton')}
							</DesktopAppButton>
						</div>
					)}
				</DesktopAppPanel>
			)}
		</div>
	);
};
