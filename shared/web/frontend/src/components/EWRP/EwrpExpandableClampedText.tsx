/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyboard-friendly two-line clamp with expand/collapse for long EWRP copy (errors, topics).
 *
 * Invariants:
 * - Short text renders without toggle; long/multiline text clamps when collapsed (`maxLines` 1 or 2).
 * - `stopTogglePropagation` prevents row selection when expanding inside list buttons.
 *
 * Related:
 * - `ewrpExpandableClampedText.ts`, `EwrpHistoryRow`, `EwrpInlineErrorAlert`
 */

import { cn } from '@/utils/cn';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useTranslation } from 'react-i18next';
import { useId, useState } from 'react';
import { ewrpClampedTextNeedsExpand } from './ewrpExpandableClampedText';

export type EwrpExpandableClampedTextTone = 'error' | 'secondary';

export type EwrpExpandableClampedTextProps = {
	text: string;
	className?: string;
	/** When true, omit outer spacing wrapper (inline inside alerts). */
	embedded?: boolean;
	tone?: EwrpExpandableClampedTextTone;
	/** Override default i18n keys for expand/collapse labels. */
	expandLabelKey?: string;
	collapseLabelKey?: string;
	/** Extra classes on the clamped paragraph. */
	textClassName?: string;
	/** Fixed id for aria-labelledby on parent dialogs. */
	id?: string;
	/** Stop click bubbling (nested inside row buttons). */
	stopTogglePropagation?: boolean;
	/** Collapsed line clamp depth (default 2). */
	maxLines?: 1 | 2;
};

const toneTextClass: Record<EwrpExpandableClampedTextTone, string> = {
	error: 'text-xs leading-relaxed text-red-300/90',
	secondary: 'text-xs leading-relaxed text-(--desktop-text-secondary)',
};

const toneButtonClass: Record<EwrpExpandableClampedTextTone, string> = {
	error: 'text-red-200/90 hover:text-red-100',
	secondary: 'text-(--desktop-text-dim) hover:text-(--desktop-text-secondary)',
};

export function EwrpExpandableClampedText({
	text,
	className,
	embedded = false,
	tone = 'secondary',
	expandLabelKey,
	collapseLabelKey,
	textClassName,
	id,
	stopTogglePropagation = false,
	maxLines = 2,
}: EwrpExpandableClampedTextProps) {
	const { t } = useTranslation('ewrp');
	const [expanded, setExpanded] = useState(false);
	const generatedId = useId();
	const textId = id ?? generatedId;
	const needsExpand = ewrpClampedTextNeedsExpand(text);
	const clampClass = maxLines === 1 ? 'line-clamp-1' : 'line-clamp-2';
	const expandKey =
		expandLabelKey ??
		(tone === 'error' ? 'historyList.errorExpand' : 'historyList.topicExpand');
	const collapseKey =
		collapseLabelKey ??
		(tone === 'error'
			? 'historyList.errorCollapse'
			: 'historyList.topicCollapse');

	const body = (
		<>
			<p
				id={textId}
				className={cn(
					toneTextClass[tone],
					textClassName,
					!expanded && needsExpand && clampClass
				)}
			>
				{text}
			</p>
			{needsExpand ? (
				<button
					type="button"
					className={cn(
						'mt-1 text-[11px] font-medium underline-offset-2 hover:underline',
						toneButtonClass[tone],
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-expanded={expanded}
					aria-controls={textId}
					onClick={(event) => {
						if (stopTogglePropagation) {
							event.stopPropagation();
						}
						setExpanded((value) => !value);
					}}
				>
					{expanded ? t(collapseKey) : t(expandKey)}
				</button>
			) : null}
		</>
	);

	if (embedded) {
		return <div className={cn('min-w-0', className)}>{body}</div>;
	}

	return <div className={cn('mt-1', className)}>{body}</div>;
}
