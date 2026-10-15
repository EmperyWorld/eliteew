/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rich in-chat summary when a user workflow finishes — playable tracks, image preview, files, catalog.
 *
 * Invariants:
 * - Image previews use authenticated blob fetch (CompanionOperationImagePreview).
 *
 * Related:
 * - src/features/ewa/companionOperations/InTranscriptProgressBanner.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import {
	ArrowsPointingOutIcon,
	ClipboardDocumentIcon,
	ClipboardDocumentListIcon,
	DocumentTextIcon,
	FolderOpenIcon,
	PaperAirplaneIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionOperationImagePreview } from '@/features/ewa/companionOperations/CompanionOperationImagePreview';
import type {
	WorkflowCompletionSummaryItem,
	WorkflowStepArtifact,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { cn } from '@/lib/utils';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';

export type WorkflowCompletionSummaryProps = {
	summary: WorkflowCompletionSummaryItem;
	onPlayTrack: (action: CompanionChatAction) => void;
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenContentManager: () => void;
	onOpenPresentationInEwrp?: (jobId: string) => void;
	onDraftPlayPrompt?: (text: string) => void;
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

function ArtifactCard({
	artifact,
	onPlayTrack,
	onOpenDocEditor,
	onOpenContentManager,
	onOpenPresentationInEwrp,
	onDraftPlayPrompt,
	onOpenCompanionPlan,
	onEnlargeImage,
}: {
	artifact: WorkflowStepArtifact;
	onPlayTrack: (action: CompanionChatAction) => void;
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenContentManager: () => void;
	onOpenPresentationInEwrp?: (jobId: string) => void;
	onDraftPlayPrompt?: (text: string) => void;
	onOpenCompanionPlan?: () => void;
	onEnlargeImage: (contentId: string) => void;
}) {
	const { t } = useTranslation('marketing');
	const [copied, setCopied] = useState(false);

	if (artifact.kind === 'image') {
		return (
			<div className="flex items-start gap-2 rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/25 p-2">
				<button
					type="button"
					className={cn(
						'shrink-0 overflow-hidden rounded border border-(--companion-divider)',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={() => onEnlargeImage(artifact.unifiedContentId)}
					aria-label={t('ewaCompanion.workflowSummaryViewImage')}
				>
					<CompanionOperationImagePreview
						contentId={artifact.unifiedContentId}
						className="size-20 object-cover"
					/>
				</button>
				<div className="min-w-0 flex-1 space-y-1">
					<p className="text-[11px] font-medium text-(--desktop-text-primary)">
						{artifact.label}
					</p>
					<p className="line-clamp-2 text-[10px] text-(--companion-text-soft)">
						{artifact.promptPreview}
					</p>
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
							'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onEnlargeImage(artifact.unifiedContentId)}
					>
						<ArrowsPointingOutIcon className="size-3" aria-hidden />
						{t('ewaCompanion.workflowSummaryViewImage')}
					</button>
				</div>
			</div>
		);
	}

	if (artifact.kind === 'music') {
		const trackLabel =
			artifact.trackName.trim() || t('ewaCompanion.operationTrackUntitled');
		return (
			<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
				<p className="text-[11px] font-medium text-emerald-100">
					{artifact.label}
				</p>
				<p className="mt-0.5 truncate text-[11px] text-emerald-200/90">
					{trackLabel}
				</p>
				<button
					type="button"
					className={cn(
						'mt-1.5 inline-flex items-center gap-1 rounded-md border border-emerald-500/50 px-2 py-1',
						'bg-emerald-500/15 text-[11px] text-emerald-50 hover:bg-emerald-500/25',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={() => {
						onPlayTrack({
							type: 'music_play_track',
							unified_content_id: artifact.unifiedContentId,
							track_name: trackLabel,
							...(artifact.thumbnailUrl
								? { thumbnail_url: artifact.thumbnailUrl }
								: {}),
						});
					}}
				>
					<PlayIcon className="size-3.5" aria-hidden />
					{t('ewaCompanion.workflowSummaryPlayTrack')}
				</button>
			</div>
		);
	}

	if (artifact.kind === 'file') {
		return (
			<div className="flex items-start gap-2 rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/25 p-2">
				<DocumentTextIcon
					className="mt-0.5 size-5 shrink-0 text-(--companion-aura)"
					aria-hidden
				/>
				<div className="min-w-0 flex-1 space-y-1">
					<p className="text-[11px] font-medium text-(--desktop-text-primary)">
						{t('ewaCompanion.workflowSummaryFileCreated', {
							name: artifact.fileName,
						})}
					</p>
					{artifact.unifiedContentId ? (
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
								'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() =>
								onOpenDocEditor(artifact.unifiedContentId as string)
							}
						>
							{t('ewaCompanion.workflowSummaryOpenFile')}
						</button>
					) : null}
				</div>
			</div>
		);
	}

	if (artifact.kind === 'presentation') {
		return (
			<div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2">
				<p className="text-[11px] font-medium text-sky-100">{artifact.title}</p>
				{artifact.topic ? (
					<p className="mt-0.5 text-[10px] text-sky-100/80">{artifact.topic}</p>
				) : null}
				{onOpenPresentationInEwrp ? (
					<button
						type="button"
						className={cn(
							'mt-1.5 inline-flex items-center gap-1 rounded-md border border-sky-500/50 px-2 py-0.5',
							'text-[10px] text-sky-50 hover:bg-sky-500/20',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onOpenPresentationInEwrp(artifact.jobId)}
					>
						{t('ewaCompanion.workflowStepOpenPresentation')}
					</button>
				) : null}
			</div>
		);
	}

	if (artifact.kind === 'plan') {
		return (
			<div className="rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/25 p-2">
				<p className="text-[11px] font-medium text-(--desktop-text-primary)">
					{artifact.label}
				</p>
				<pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word text-[10px] leading-snug text-(--companion-text-soft)">
					{artifact.body}
				</pre>
				<div className="mt-1.5 flex flex-wrap gap-1">
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
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
							'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={async () => {
							const ok = await copyTextToClipboard(artifact.body);
							if (ok) {
								setCopied(true);
								window.setTimeout(() => setCopied(false), 1800);
							}
						}}
					>
						<ClipboardDocumentIcon className="size-3" aria-hidden />
						{copied
							? t('ewaCompanion.workflowStepCopied')
							: t('ewaCompanion.workflowStepCopy')}
					</button>
					{onDraftPlayPrompt ? (
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
					) : null}
				</div>
			</div>
		);
	}

	if (artifact.kind === 'text') {
		const body = artifact.body;
		return (
			<div className="rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/25 p-2">
				<p className="text-[11px] font-medium text-(--desktop-text-primary)">
					{artifact.label}
				</p>
				<pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word text-[10px] leading-snug text-(--companion-text-soft)">
					{body}
				</pre>
				<div className="mt-1.5 flex flex-wrap gap-1">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
							'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={async () => {
							const ok = await copyTextToClipboard(body);
							if (ok) {
								setCopied(true);
								window.setTimeout(() => setCopied(false), 1800);
							}
						}}
					>
						<ClipboardDocumentIcon className="size-3" aria-hidden />
						{copied
							? t('ewaCompanion.workflowStepCopied')
							: t('ewaCompanion.workflowStepCopy')}
					</button>
					{onDraftPlayPrompt ? (
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
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/25 p-2">
			<p className="text-[11px] font-medium text-(--desktop-text-primary)">
				{t('ewaCompanion.workflowSummaryCatalogFiles', {
					count: artifact.rowCount,
				})}
			</p>
			{artifact.fileNames.length > 0 ? (
				<ul className="mt-1 space-y-0.5 text-[10px] text-(--companion-text-soft)">
					{artifact.fileNames.map((name) => (
						<li key={name} className="truncate">
							· {name}
						</li>
					))}
				</ul>
			) : null}
			<button
				type="button"
				className={cn(
					'mt-1.5 inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
					'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={onOpenContentManager}
			>
				<FolderOpenIcon className="size-3" aria-hidden />
				{t('ewaCompanion.workflowSummaryOpenCatalog')}
			</button>
		</div>
	);
}

export function WorkflowCompletionSummary({
	summary,
	onPlayTrack,
	onOpenDocEditor,
	onOpenContentManager,
	onOpenPresentationInEwrp,
	onDraftPlayPrompt,
	onOpenCompanionPlan,
}: WorkflowCompletionSummaryProps) {
	const { t } = useTranslation('marketing');
	const [enlargedImageId, setEnlargedImageId] = useState<string | null>(null);
	const stepRows = summary.stepResults.filter(
		(row) =>
			row.status === 'completed' &&
			!summary.artifacts.some((a) => a.stepIndex === row.stepIndex)
	);

	return (
		<li
			className={cn(
				'flex flex-col gap-2 border-t border-(--companion-divider) py-2',
				'rounded-md border px-3 py-2.5',
				summary.failed
					? 'border-rose-500/40 bg-rose-500/5'
					: 'border-emerald-500/35 bg-emerald-500/8'
			)}
			data-testid="ewa-companion-workflow-summary"
			data-run-id={summary.runId}
		>
			<div className="flex items-start gap-2">
				{summary.failed ? (
					<ExclamationCircleIcon
						className="mt-0.5 size-4 shrink-0 text-rose-400"
						aria-hidden
					/>
				) : (
					<CheckCircleIcon
						className="mt-0.5 size-4 shrink-0 text-emerald-400"
						aria-hidden
					/>
				)}
				<div className="min-w-0 flex-1">
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'font-medium uppercase tracking-wider text-(--companion-aura)'
						)}
					>
						{t('ewaCompanion.workflowSummaryTitle')}
					</span>
					<p className="text-[13px] font-medium text-(--desktop-text-primary)">
						{summary.title}
					</p>
					<p className="text-[11px] text-(--companion-text-soft)">
						{summary.failed
							? t('ewaCompanion.workflowSummaryPartial')
							: t('ewaCompanion.workflowSummaryCompleted')}
					</p>
				</div>
			</div>
			{summary.artifacts.length > 0 ? (
				<div className="flex flex-col gap-2">
					{summary.artifacts.map((artifact) => (
						<ArtifactCard
							key={`${summary.runId}:${artifact.kind}:${artifact.stepIndex}`}
							artifact={artifact}
							onPlayTrack={onPlayTrack}
							onOpenDocEditor={onOpenDocEditor}
							onOpenContentManager={onOpenContentManager}
							onOpenPresentationInEwrp={onOpenPresentationInEwrp}
							onDraftPlayPrompt={onDraftPlayPrompt}
							onOpenCompanionPlan={onOpenCompanionPlan}
							onEnlargeImage={setEnlargedImageId}
						/>
					))}
				</div>
			) : null}
			{stepRows.length > 0 ? (
				<div className="flex flex-col gap-1.5">
					{stepRows.map((row) =>
						row.text ? (
							<div
								key={`${summary.runId}:step:${row.stepIndex}`}
								className="rounded-md border border-(--companion-divider)/50 bg-(--desktop-surface-soft)/20 p-2"
							>
								<p className="text-[11px] font-medium text-(--desktop-text-primary)">
									{row.label}
								</p>
								<pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap wrap-break-word text-[10px] text-(--companion-text-soft)">
									{row.text}
								</pre>
							</div>
						) : null
					)}
				</div>
			) : null}
			{enlargedImageId ? (
				<div
					className="fixed inset-0 z-12000 flex items-center justify-center bg-black/80 p-4"
					role="dialog"
					aria-modal="true"
					aria-label={t('ewaCompanion.operationsImageEnlarge')}
					onClick={(event) => {
						if (event.target === event.currentTarget) {
							setEnlargedImageId(null);
						}
					}}
					onKeyDown={(event) => {
						if (event.key === 'Escape') setEnlargedImageId(null);
					}}
				>
					<button
						type="button"
						className="absolute right-4 top-4 rounded-md border border-white/20 px-2 py-1 text-[12px] text-white"
						onClick={() => setEnlargedImageId(null)}
					>
						{t('ewaCompanion.operationsImageClosePreview')}
					</button>
					<CompanionOperationImagePreview
						contentId={enlargedImageId}
						className="max-h-[90vh] max-w-[90vw] rounded object-contain"
					/>
				</div>
			) : null}
		</li>
	);
}
