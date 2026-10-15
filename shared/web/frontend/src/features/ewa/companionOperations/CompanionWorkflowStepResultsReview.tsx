/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-step workflow result review in the operations card — text preview, copy, and artifact actions.
 *
 * Invariants:
 * - Read-only view of persisted step output_payload; does not re-run tools.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 */

import {
	ClipboardDocumentIcon,
	ClipboardDocumentListIcon,
	DocumentTextIcon,
	PaperAirplaneIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionOperationImagePreview } from '@/features/ewa/companionOperations/CompanionOperationImagePreview';
import type {
	WorkflowStepArtifact,
	WorkflowStepResultRow,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { extractWorkflowStepResultRows } from '@/features/ewa/companionOperations/companionOperationsUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionWorkflowStepResultsReviewProps = {
	run: EwaCompanionTaskRun;
	onPlayTrack: (action: CompanionChatAction) => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenPresentationInEwrp: (jobId: string) => void;
	onOpenContentManager: () => void;
	onOpenCompanionPlan?: () => void;
};

async function copyTextToClipboard(text: string): Promise<boolean> {
	const value = text.trim();
	if (!value) return false;
	try {
		await navigator.clipboard.writeText(value);
		return true;
	} catch {
		return false;
	}
}

function StepArtifactActions({
	artifact,
	onPlayTrack,
	onOpenDocEditor,
	onOpenPresentationInEwrp,
	onOpenContentManager,
	onDraftPlayPrompt,
	onOpenCompanionPlan,
}: {
	artifact: WorkflowStepArtifact;
	onPlayTrack: (action: CompanionChatAction) => void;
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenPresentationInEwrp: (jobId: string) => void;
	onOpenContentManager: () => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenCompanionPlan?: () => void;
}) {
	const { t } = useTranslation('marketing');

	if (artifact.kind === 'music') {
		const trackLabel =
			artifact.trackName.trim() || t('ewaCompanion.operationTrackUntitled');
		return (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-emerald-500/50 px-2 py-0.5',
					'text-[10px] text-emerald-100 hover:bg-emerald-500/15',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() =>
					onPlayTrack({
						type: 'music_play_track',
						unified_content_id: artifact.unifiedContentId,
						track_name: trackLabel,
						...(artifact.thumbnailUrl
							? { thumbnail_url: artifact.thumbnailUrl }
							: {}),
					})
				}
			>
				<PlayIcon className="size-3" aria-hidden />
				{t('ewaCompanion.workflowSummaryPlayTrack')}
			</button>
		);
	}

	if (artifact.kind === 'file' && artifact.unifiedContentId) {
		return (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
					'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onOpenDocEditor(artifact.unifiedContentId as string)}
			>
				<DocumentTextIcon className="size-3" aria-hidden />
				{t('ewaCompanion.workflowSummaryOpenFile')}
			</button>
		);
	}

	if (artifact.kind === 'presentation') {
		return (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-2 py-0.5',
					'text-[10px] text-sky-100 hover:bg-sky-500/10',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onOpenPresentationInEwrp(artifact.jobId)}
			>
				{t('ewaCompanion.workflowStepOpenPresentation')}
			</button>
		);
	}

	if (artifact.kind === 'catalog') {
		return (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
					'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={onOpenContentManager}
			>
				{t('ewaCompanion.workflowSummaryOpenCatalog')}
			</button>
		);
	}

	if (artifact.kind === 'plan') {
		return (
			<>
				{onOpenCompanionPlan ? (
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-emerald-500/45 px-2 py-0.5',
							'text-[10px] text-emerald-100 hover:bg-emerald-500/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={onOpenCompanionPlan}
					>
						<ClipboardDocumentListIcon className="size-3" aria-hidden />
						{t('ewaCompanion.workflowStepOpenPlan')}
					</button>
				) : null}
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1 rounded-md border border-(--companion-aura)/40 px-2 py-0.5',
						'text-[10px] text-(--companion-aura) hover:bg-(--companion-aura)/10',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={() =>
						onDraftPlayPrompt(
							t('ewaCompanion.workflowStepUseInChatPrompt', {
								label: artifact.label,
							})
						)
					}
				>
					<PaperAirplaneIcon className="size-3" aria-hidden />
					{t('ewaCompanion.workflowStepUseInChat')}
				</button>
			</>
		);
	}

	if (artifact.kind === 'text') {
		return (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-(--companion-aura)/40 px-2 py-0.5',
					'text-[10px] text-(--companion-aura) hover:bg-(--companion-aura)/10',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() =>
					onDraftPlayPrompt(
						t('ewaCompanion.workflowStepUseInChatPrompt', {
							label: artifact.label,
						})
					)
				}
			>
				<PaperAirplaneIcon className="size-3" aria-hidden />
				{t('ewaCompanion.workflowStepUseInChat')}
			</button>
		);
	}

	if (artifact.kind === 'image') {
		return (
			<CompanionOperationImagePreview
				contentId={artifact.unifiedContentId}
				className="size-14 rounded border border-(--companion-divider) object-cover"
			/>
		);
	}

	return null;
}

function StepResultRow({
	row,
	onPlayTrack,
	onDraftPlayPrompt,
	onOpenDocEditor,
	onOpenPresentationInEwrp,
	onOpenContentManager,
	onOpenCompanionPlan,
}: {
	row: WorkflowStepResultRow;
	onPlayTrack: (action: CompanionChatAction) => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenPresentationInEwrp: (jobId: string) => void;
	onOpenContentManager: () => void;
	onOpenCompanionPlan?: () => void;
}) {
	const { t } = useTranslation('marketing');
	const [copied, setCopied] = useState(false);
	const body =
		row.text || (row.artifact?.kind === 'plan' ? row.artifact.body : '');
	const showText = body.trim().length >= 8;

	const handleCopy = async () => {
		const ok = await copyTextToClipboard(body);
		if (ok) {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		}
	};

	return (
		<li
			className={cn(
				'rounded-md border px-2 py-1.5',
				row.status === 'failed'
					? 'border-rose-500/35 bg-rose-500/5'
					: row.status === 'completed'
						? 'border-emerald-500/25 bg-emerald-500/5'
						: 'border-(--companion-divider)/50 bg-(--desktop-surface-soft)/20'
			)}
			data-testid="ewa-workflow-step-result"
			data-step-index={row.stepIndex}
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-[11px] font-medium text-(--desktop-text-primary)">
					{row.label}
				</p>
				<span className="shrink-0 text-[10px] text-(--companion-text-soft)">
					{t(`ewaCompanion.workflowStepStatus_${row.status}`, {
						defaultValue: row.status,
					})}
				</span>
			</div>
			{row.errorMessage ? (
				<p className="mt-1 text-[10px] leading-snug text-rose-200">
					{row.errorMessage}
				</p>
			) : null}
			{showText ? (
				<pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded border border-(--companion-divider)/40 bg-(--companion-bg)/40 p-1.5 text-[10px] leading-snug text-(--desktop-text-primary)">
					{body}
				</pre>
			) : null}
			<div className="mt-1 flex flex-wrap items-center gap-1">
				{showText ? (
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
							'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => void handleCopy()}
					>
						<ClipboardDocumentIcon className="size-3" aria-hidden />
						{copied
							? t('ewaCompanion.workflowStepCopied')
							: t('ewaCompanion.workflowStepCopy')}
					</button>
				) : null}
				{row.artifact ? (
					<StepArtifactActions
						artifact={row.artifact}
						onPlayTrack={onPlayTrack}
						onOpenDocEditor={onOpenDocEditor}
						onOpenPresentationInEwrp={onOpenPresentationInEwrp}
						onOpenContentManager={onOpenContentManager}
						onDraftPlayPrompt={onDraftPlayPrompt}
						onOpenCompanionPlan={onOpenCompanionPlan}
					/>
				) : null}
			</div>
		</li>
	);
}

export function CompanionWorkflowStepResultsReview({
	run,
	onPlayTrack,
	onDraftPlayPrompt,
	onOpenDocEditor,
	onOpenPresentationInEwrp,
	onOpenContentManager,
	onOpenCompanionPlan,
}: CompanionWorkflowStepResultsReviewProps) {
	const { t } = useTranslation('marketing');
	const rows = extractWorkflowStepResultRows(run);
	const reviewable = rows.filter(
		(row) =>
			row.status === 'completed' ||
			row.status === 'failed' ||
			row.text ||
			row.errorMessage ||
			row.artifact
	);
	if (reviewable.length === 0) return null;

	return (
		<div
			className="mt-2 rounded-md border border-(--companion-divider)/60 bg-(--desktop-surface-soft)/15 p-2"
			data-testid="ewa-workflow-step-results-review"
		>
			<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-(--companion-aura)">
				{t('ewaCompanion.workflowStepResultsTitle')}
			</p>
			<ol className="flex flex-col gap-1.5">
				{reviewable.map((row) => (
					<StepResultRow
						key={`${run.id}:${row.stepIndex}`}
						row={row}
						onPlayTrack={onPlayTrack}
						onDraftPlayPrompt={onDraftPlayPrompt}
						onOpenDocEditor={onOpenDocEditor}
						onOpenPresentationInEwrp={onOpenPresentationInEwrp}
						onOpenContentManager={onOpenContentManager}
						onOpenCompanionPlan={onOpenCompanionPlan}
					/>
				))}
			</ol>
		</div>
	);
}
