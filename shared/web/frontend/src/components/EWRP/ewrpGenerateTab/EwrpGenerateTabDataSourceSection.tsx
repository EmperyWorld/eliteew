/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-5 CM data-source fieldset (doc picker / clear) for the EWRP Generate form.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `EwrpExpandableClampedText.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
	sw,
	contentTypeBadgeShort,
	type ContentItem,
	EwrpFormSectionHeader,
} from '../EwrpGeneratorChunks';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from '../ewrpExpandableClampedText';

export type EwrpGenerateTabDataSourceSectionProps = {
	sourceDocument: ContentItem | null;
	sourceDocumentLoading: boolean;
	onSourceDocumentClear: () => void;
	onOpenDocPicker: () => void;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	formLocked: boolean;
	ewrpFieldsetOptionalShellClass: string;
};

export function EwrpGenerateTabDataSourceSection({
	sourceDocument,
	sourceDocumentLoading,
	onSourceDocumentClear,
	onOpenDocPicker,
	secondaryBtnClass,
	primaryBtnClass,
	formLocked,
	ewrpFieldsetOptionalShellClass,
}: EwrpGenerateTabDataSourceSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<fieldset className={ewrpFieldsetOptionalShellClass}>
			<legend className="sr-only">{t('form.dataSourceLegend')}</legend>
			<EwrpFormSectionHeader
				step="5"
				badge="optional"
				title={t('form.dataSourceTitle')}
				hint={t('form.dataSourceHint')}
			/>
			<div
				className={cn(
					'flex flex-col gap-3 rounded-2xl border px-3 py-3 motion-safe:transition-[box-shadow,border-color] motion-safe:duration-200 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5',
					sourceDocument
						? 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[linear-gradient(135deg,rgb(var(--desktop-accent-rgb)/0.09)_0%,rgb(var(--desktop-accent-rgb)/0.02)_100%)] shadow-[0_2px_16px_-6px_rgb(var(--desktop-accent-rgb)/0.22)]'
						: 'border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/35'
				)}
				aria-busy={sourceDocumentLoading || undefined}
				data-ewrp-guide="doc-picker"
			>
				<div className="flex min-w-0 items-start gap-2.5 text-xs text-(--desktop-text-secondary)">
					<DocumentTextIcon
						className={cn(
							'mt-0.5 h-4 w-4 shrink-0',
							sourceDocument
								? 'text-[rgb(var(--desktop-accent-rgb))]'
								: 'text-[rgb(var(--desktop-accent-rgb)/0.75)]'
						)}
						strokeWidth={sw}
					/>
					{sourceDocumentLoading ? (
						<span className="inline-flex items-center gap-1.5 text-(--desktop-text-dim)">
							<ArrowPathIcon
								className="h-3.5 w-3.5 shrink-0 animate-spin"
								strokeWidth={sw}
								aria-hidden
							/>
							{t('form.statusMetaSourceLoading')}
						</span>
					) : sourceDocument ? (
						<div className="min-w-0 flex-1">
							{ewrpClampedTextNeedsExpand(sourceDocument.name) ? (
								<EwrpExpandableClampedText
									text={`${t('form.filePrefix')} ${sourceDocument.name}`}
									tone="secondary"
									className="mt-0"
									textClassName="text-xs text-(--desktop-text-secondary)"
									expandLabelKey="form.fileNameExpand"
									collapseLabelKey="form.fileNameCollapse"
								/>
							) : (
								<span>
									<span className="text-(--desktop-text-dim)">
										{t('form.filePrefix')}
									</span>{' '}
									<span className="font-semibold text-(--desktop-text-primary)">
										{sourceDocument.name}
									</span>
								</span>
							)}
							<span className="ml-1.5 inline-flex items-center rounded-md border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-panel)/80 px-1.5 py-px text-[10px] font-medium text-(--desktop-text-secondary)">
								{contentTypeBadgeShort(sourceDocument.content_type)}
							</span>
						</div>
					) : (
						<span className="text-(--desktop-text-dim)">
							{t('form.noFileChosen')}
						</span>
					)}
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{sourceDocument && (
						<button
							type="button"
							onClick={onSourceDocumentClear}
							disabled={sourceDocumentLoading || formLocked}
							className={secondaryBtnClass}
						>
							{t('form.clearFile')}
						</button>
					)}
					<button
						type="button"
						onClick={onOpenDocPicker}
						disabled={sourceDocumentLoading || formLocked}
						aria-busy={sourceDocumentLoading || undefined}
						className={cn(
							primaryBtnClass,
							'w-auto px-4 py-2.5 text-xs shadow-[0_4px_20px_-8px_rgb(var(--desktop-accent-rgb)/0.45)]',
							sourceDocumentLoading && 'pointer-events-none opacity-60'
						)}
					>
						{t('form.pickFromLibrary')}
					</button>
				</div>
			</div>
		</fieldset>
	);
}
