/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin catalog toolbar: title search and status filter chips.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

const STATUS_CHIPS = ['', 'draft', 'published', 'archived'] as const;

type Props = {
	query: string;
	statusFilter: string;
	onQueryChange: (value: string) => void;
	onStatusChange: (value: string) => void;
};

export function SurveyAdminCatalogToolbar({
	query,
	statusFilter,
	onQueryChange,
	onStatusChange,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<div className="space-y-3">
			<label className="block space-y-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.catalogSearch')}
				</span>
				<input
					type="search"
					value={query}
					placeholder={t('admin.catalogSearchPlaceholder')}
					className={cn(
						'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
						'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
						'placeholder:text-(--desktop-text-dim)',
						'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
					)}
					onChange={(e) => onQueryChange(e.target.value)}
				/>
			</label>
			<fieldset className="space-y-2 border-0 p-0">
				<legend className={cn(DESKTOP_TYPOGRAPHY.caption, 'sr-only')}>
					{t('admin.catalogStatusFilter')}
				</legend>
				<div className="flex flex-wrap gap-2">
					{STATUS_CHIPS.map((status) => {
						const active = statusFilter === status;
						return (
							<button
								key={status || 'all'}
								type="button"
								className={cn(
									'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
									active
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary) hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]'
								)}
								onClick={() => onStatusChange(status)}
							>
								{status ? t(`admin.status.${status}`) : t('admin.allStatuses')}
							</button>
						);
					})}
				</div>
			</fieldset>
		</div>
	);
}
