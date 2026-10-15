/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Date range filter for admin survey responses list and CSV export.
 *
 * Related:
 * - SurveyAdminResponsesTable.tsx
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

const INPUT_CLASS = cn(
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

export type SurveyResponsesDateFilterValue = {
	from: string;
	to: string;
};

type Props = {
	value: SurveyResponsesDateFilterValue;
	onChange: (next: SurveyResponsesDateFilterValue) => void;
	onApply: () => void;
	onClear: () => void;
};

export function SurveyAdminResponsesDateFilter({
	value,
	onChange,
	onApply,
	onClear,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const hasDraft = Boolean(value.from || value.to);
	const invalidRange = Boolean(value.from && value.to) && value.from > value.to;

	return (
		<DesktopAppPanel className="flex flex-wrap items-end gap-3 p-3">
			<label className="flex flex-col gap-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.responsesDateFilter.from')}
				</span>
				<input
					type="date"
					className={INPUT_CLASS}
					value={value.from}
					onChange={(e) => onChange({ ...value, from: e.target.value })}
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.responsesDateFilter.to')}
				</span>
				<input
					type="date"
					className={INPUT_CLASS}
					value={value.to}
					min={value.from || undefined}
					onChange={(e) => onChange({ ...value, to: e.target.value })}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					size="sm"
					variant="accent"
					disabled={!hasDraft || invalidRange}
					onClick={onApply}
				>
					{t('admin.responsesDateFilter.apply')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={!hasDraft}
					onClick={onClear}
				>
					{t('admin.responsesDateFilter.clear')}
				</DesktopAppButton>
			</div>
			{invalidRange ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-danger)')}
				>
					{t('admin.responsesDateFilter.invalidRange')}
				</p>
			) : null}
		</DesktopAppPanel>
	);
}
