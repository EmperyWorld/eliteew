/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prompt preview panel: question input, run, stats, and copy full prompt.
 *
 * Invariants:
 * - Enter in question field triggers preview run.
 *
 * Related:
 * - pages/Admin/assistant/useAssistantPreview.ts
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import type { AssistantPreviewResult } from '../../Desktop/services/productDesktopApi';
import { ADMIN_FIELD } from './assistantAdminStyles';

type AssistantPreviewPanelProps = {
	panelRef: React.RefObject<HTMLDivElement | null>;
	previewQuestion: string;
	setPreviewQuestion: (v: string) => void;
	previewIncludeMyHistory: boolean;
	setPreviewIncludeMyHistory: (v: boolean) => void;
	previewResult: AssistantPreviewResult | null;
	onRunPreview: () => void;
	onCopyPrompt: () => void;
	isPending: boolean;
};

export function AssistantPreviewPanel({
	panelRef,
	previewQuestion,
	setPreviewQuestion,
	previewIncludeMyHistory,
	setPreviewIncludeMyHistory,
	previewResult,
	onRunPreview,
	onCopyPrompt,
	isPending,
}: AssistantPreviewPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	return (
		<div
			ref={panelRef}
			className={cn(
				'border border-white/10 bg-white/3 p-4 space-y-3 shadow-sm shadow-black/25',
				DESKTOP_SURFACE.radius
			)}
		>
			<div className={DESKTOP_TYPOGRAPHY.caption}>{t('previewCaption')}</div>
			<p className="text-xs text-white/55">{t('previewHint')}</p>
			<input
				type="text"
				value={previewQuestion}
				onChange={(e) => setPreviewQuestion(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						onRunPreview();
					}
				}}
				placeholder={t('previewQuestionPlaceholder')}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<p className="text-[11px] text-white/40">{t('previewRunShortcut')}</p>
			<label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
				<input
					type="checkbox"
					checked={previewIncludeMyHistory}
					onChange={(e) => setPreviewIncludeMyHistory(e.target.checked)}
					className="rounded border-white/20 bg-black/30"
				/>
				{t('previewIncludeMyHistory')}
			</label>
			<button
				type="button"
				disabled={!previewQuestion.trim() || isPending}
				onClick={onRunPreview}
				className={cn(
					'px-4 py-2 text-sm text-white',
					DESKTOP_SURFACE.radius,
					DESKTOP_INTERACTIVE.btnRounded,
					'bg-violet-800/70 hover:bg-violet-700/80 border border-violet-500/25',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45',
					'disabled:opacity-50'
				)}
			>
				{isPending ? (
					<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
				) : (
					t('previewRun')
				)}
			</button>
			{previewResult ? (
				<div className="space-y-2 rounded border border-white/10 bg-black/20 p-3 text-xs text-white/75">
					<p>
						{t('previewStats', {
							model: previewResult.model,
							prompt: previewResult.prompt_chars,
							faq: previewResult.faq_chars,
							rag: previewResult.rag_chars,
							history: previewResult.history_chars,
						})}
					</p>
					{previewResult.rag_source_labels.length > 0 ? (
						<p>
							{t('previewSources', {
								sources: previewResult.rag_source_labels.join(', '),
							})}
						</p>
					) : null}
					{previewResult.prompt_chars > previewResult.prompt_preview.length ? (
						<p className="text-xs text-white/45">
							{t('previewTruncatedHint', {
								total: previewResult.prompt_chars,
							})}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1.5 px-2 py-1 text-xs text-white/75',
								DESKTOP_SURFACE.radius,
								'border border-white/15 hover:bg-white/10',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45'
							)}
							onClick={() => void onCopyPrompt()}
						>
							<ClipboardDocumentIcon className="h-3.5 w-3.5" aria-hidden />
							{t('previewCopyPrompt')}
						</button>
					</div>
					<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-white/80">
						{previewResult.prompt_preview}
					</pre>
				</div>
			) : null}
		</div>
	);
}
