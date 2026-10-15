/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky workspace context bar (headline + slides/theme/source chips) on Generate tab.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 * - Renders null when topic, title, and jobId are all empty/absent.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `useEwrpGenerateTabDerived.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { sw, type ContentItem } from '../EwrpGeneratorChunks';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from '../ewrpExpandableClampedText';

export type EwrpGenerateTabStickyContextProps = {
	topic: string;
	title: string;
	jobId: string | null;
	statusLiveText: string;
	numSlides: number;
	sourceDocument: ContentItem | null;
	stickyContextBarClass: string;
	stickyHeadline: string;
	statusMetaSlideCount: number | null;
	stickySlidesMismatch: boolean;
	stickyFormThemeLabel: string | null;
	stickyFormThemeDisplayLabel: string;
	stickyJobThemeLabel: string | null;
	stickyThemeMismatch: boolean;
	stickyFormSourcePending: boolean;
};

export function EwrpGenerateTabStickyContext({
	topic,
	title,
	jobId,
	statusLiveText,
	numSlides,
	sourceDocument,
	stickyContextBarClass,
	stickyHeadline,
	statusMetaSlideCount,
	stickySlidesMismatch,
	stickyFormThemeLabel,
	stickyFormThemeDisplayLabel,
	stickyJobThemeLabel,
	stickyThemeMismatch,
	stickyFormSourcePending,
}: EwrpGenerateTabStickyContextProps) {
	const { t } = useTranslation('ewrp');

	if (!(topic.trim() || title.trim() || jobId)) return null;

	return (
		<div
			className={stickyContextBarClass}
			role="status"
			aria-live="polite"
			aria-label={t('sticky.ariaLabel')}
		>
			{ewrpClampedTextNeedsExpand(stickyHeadline) ? (
				<EwrpExpandableClampedText
					text={stickyHeadline}
					tone="secondary"
					className="mt-0"
					textClassName={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'font-semibold text-(--desktop-text-primary)'
					)}
					expandLabelKey="sticky.contextExpand"
					collapseLabelKey="sticky.contextCollapse"
				/>
			) : (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'truncate font-semibold text-(--desktop-text-primary)'
					)}
				>
					{stickyHeadline}
				</p>
			)}
			{jobId ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'mt-0.5 text-(--desktop-text-dim)'
					)}
				>
					{statusLiveText}
				</p>
			) : null}
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<span
					className={cn(
						'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
						stickySlidesMismatch
							? 'border-amber-500/35 bg-amber-500/10 text-amber-100/95'
							: 'border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 text-(--desktop-text-secondary)'
					)}
					title={
						stickySlidesMismatch && statusMetaSlideCount != null
							? t('sticky.metaSlidesMismatchTitle', {
									job: statusMetaSlideCount,
									form: numSlides,
								})
							: undefined
					}
				>
					{stickySlidesMismatch && statusMetaSlideCount != null
						? t('sticky.metaSlidesJob', {
								count: statusMetaSlideCount,
							})
						: t('sticky.metaSlides', { count: numSlides })}
				</span>
				{stickyThemeMismatch && stickyJobThemeLabel ? (
					<span
						className="inline-flex max-w-full items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100/95"
						title={t('sticky.metaThemeMismatchTitle', {
							job: stickyJobThemeLabel,
							form: stickyFormThemeDisplayLabel,
						})}
					>
						<span className="truncate">
							{t('sticky.metaThemeJob', {
								theme: stickyJobThemeLabel,
							})}
						</span>
					</span>
				) : stickyFormThemeLabel ? (
					<span
						className="inline-flex max-w-full items-center rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)"
						title={stickyFormThemeLabel}
					>
						<span className="truncate">
							{t('sticky.metaTheme', {
								theme: stickyFormThemeLabel,
							})}
						</span>
					</span>
				) : null}
				{stickyFormSourcePending ? (
					<span
						className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)"
						aria-busy
					>
						<ArrowPathIcon
							className="h-3 w-3 shrink-0 animate-spin text-(--desktop-text-dim)"
							strokeWidth={sw}
							aria-hidden
						/>
						<span className="truncate">{t('sticky.metaSourceLoading')}</span>
					</span>
				) : sourceDocument ? (
					<span
						className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)"
						title={sourceDocument.name}
					>
						<DocumentTextIcon
							className="h-3 w-3 shrink-0 text-(--desktop-text-dim)"
							strokeWidth={sw}
							aria-hidden
						/>
						<span className="truncate">
							{t('sticky.metaSource', {
								name: sourceDocument.name,
							})}
						</span>
					</span>
				) : null}
			</div>
		</div>
	);
}
