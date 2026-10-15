/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky import progress bar for DocumentImportPanel batch runs.
 *
 * Invariants:
 * - Renders nothing when progress is null.
 *
 * Related:
 * - useDocumentImportBatch.ts, DocumentImportPanel.tsx
 */

import type { TFunction } from 'i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import type { ImportProgress } from '@/components/UltimateDocEditor/types/editor.types';

type DocumentImportProgressProps = {
	t: TFunction<'docEditorPanels'>;
	progress: ImportProgress | null;
};

export function DocumentImportProgress({
	t,
	progress,
}: DocumentImportProgressProps) {
	if (!progress) {
		return null;
	}

	return (
		<div
			className="sticky top-0 z-10 border-b border-(--desktop-border-subtle) bg-blue-500/10 p-5 backdrop-blur-md"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<div className="mb-3 flex items-start gap-3">
				<ArrowPathIcon
					width={16}
					height={16}
					className="mt-0.5 shrink-0 animate-spin text-blue-300 motion-reduce:animate-none motion-reduce:opacity-80"
				/>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium text-blue-100">
						{progress.status}
					</div>
					{progress.fileName ? (
						<div
							className="mt-1 truncate text-xs text-blue-200/90"
							title={progress.fileName}
						>
							{t('panels.import.progressFileLine', {
								name: progress.fileName,
							})}
						</div>
					) : null}
				</div>
			</div>
			<div
				className="h-2.5 w-full overflow-hidden rounded-full bg-white/15"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={progress.total}
				aria-valuenow={progress.current}
				aria-label={t('panels.import.progressAria')}
			>
				<div
					className="h-full rounded-full bg-blue-500 transition-[width] duration-300 ease-out"
					style={{
						width: `${Math.min(100, (progress.current / Math.max(1, progress.total)) * 100)}%`,
					}}
				/>
			</div>
			<div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-blue-100/95">
				<span className="tabular-nums font-medium">
					{t('panels.import.progressStep', {
						current: progress.current,
						total: progress.total,
					})}
				</span>
				<span className="text-blue-200/85">
					{Math.round((progress.current / Math.max(1, progress.total)) * 100)}%
				</span>
			</div>
			{progress.method ? (
				<p className="mt-2 text-[11px] leading-relaxed text-blue-200/75">
					{progress.method}
				</p>
			) : null}
		</div>
	);
}
