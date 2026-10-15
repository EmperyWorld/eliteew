/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Displays backend-derived document sections for EWA embedded document editor and jumps by server offsets.
 *
 * Invariants:
 * - Does not parse Markdown in the browser; sections are rendered from API payload only.
 * - Textarea selection uses backend-provided UTF-16 char offsets.
 * - Structure load failures are announced as alerts; retry remains the existing refresh action.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 * - src/services/ewa/ewaCompanionDocumentSurfaceApi.ts
 */

import { ArrowPathIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	EwaCompanionDocumentStructure,
	EwaCompanionDocumentStructureSection,
} from '@/services/ewa/ewaCompanionDocumentSurfaceApi';
import { cn } from '@/utils/cn';

type Props = {
	structure: EwaCompanionDocumentStructure | null;
	loading: boolean;
	error: string | null;
	onRefresh: () => void;
	onSectionSelect: (section: EwaCompanionDocumentStructureSection) => void;
};

export function applyDocumentStructureSelection(
	textarea: HTMLTextAreaElement,
	section: Pick<EwaCompanionDocumentStructureSection, 'charStart' | 'charEnd'>
): void {
	const length = textarea.value.length;
	const start = Math.max(0, Math.min(length, Math.trunc(section.charStart)));
	const end = Math.max(start, Math.min(length, Math.trunc(section.charEnd)));
	textarea.focus();
	textarea.setSelectionRange(start, end);
	if (length > 0 && textarea.scrollHeight > textarea.clientHeight) {
		const ratio = start / length;
		textarea.scrollTop = Math.max(
			0,
			Math.floor(ratio * textarea.scrollHeight - textarea.clientHeight / 2)
		);
	}
}

export function CompanionDocumentStructurePanel({
	structure,
	loading,
	error,
	onRefresh,
	onSectionSelect,
}: Props) {
	const { t } = useTranslation('marketing');
	const sections = structure?.sections ?? [];

	return (
		<div className="mb-2 rounded-md border border-(--companion-divider)/70 bg-(--desktop-surface-soft)/15 p-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<ListBulletIcon className="size-4 text-(--companion-aura)" />
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--companion-text-soft)">
							{t('ewaCompanion.documentStructureTitle')}
						</p>
						{structure ? (
							<p className="truncate text-[11px] text-(--desktop-text-secondary)">
								{t('ewaCompanion.documentStructureSummary', {
									count: sections.length,
									lines: structure.totalLines,
								})}
							</p>
						) : null}
					</div>
				</div>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={loading}
					onClick={onRefresh}
					aria-busy={loading}
				>
					{loading ? (
						<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
					) : null}
					{structure
						? t('ewaCompanion.documentStructureRefresh')
						: t('ewaCompanion.documentStructureLoad')}
				</DesktopAppButton>
			</div>
			{error ? (
				<div
					className="mt-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-100"
					role="alert"
					aria-live="assertive"
				>
					{error}
				</div>
			) : null}
			{sections.length > 0 ? (
				<div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
					{sections.map((section) => (
						<button
							key={section.id}
							type="button"
							className={cn(
								'block w-full rounded-md border border-transparent px-2 py-1.5 text-left',
								'text-[12px] text-(--desktop-text-secondary) transition-colors',
								'hover:border-(--companion-divider) hover:bg-(--desktop-surface-soft)/30 hover:text-(--desktop-text-primary)',
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--companion-aura)/50'
							)}
							style={{
								paddingLeft: `${Math.min(section.level - 1, 4) * 0.75 + 0.5}rem`,
							}}
							onClick={() => onSectionSelect(section)}
						>
							<span className="flex items-start justify-between gap-2">
								<span className="min-w-0">
									<span className="block truncate font-medium">
										{section.title}
									</span>
									{section.preview ? (
										<span className="mt-0.5 line-clamp-1 block text-[11px] text-(--companion-text-soft)">
											{section.preview}
										</span>
									) : null}
								</span>
								<span className="shrink-0 text-[10px] tabular-nums text-(--companion-text-soft)">
									{section.lineStart}–{section.lineEnd}
								</span>
							</span>
						</button>
					))}
					{structure?.truncated ? (
						<p className="px-2 pt-1 text-[11px] text-(--companion-text-soft)">
							{t('ewaCompanion.documentStructureTruncated', {
								count: structure.maxSections,
							})}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
