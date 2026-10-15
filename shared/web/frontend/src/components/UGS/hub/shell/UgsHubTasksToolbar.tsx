/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk selection, export, and filter summary toolbar below UGS Hub task filters.
 *
 * Related:
 * - ugsHubSharedUi.tsx
 */

import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	FunnelIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { cn } from '../../../../utils/cn';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubHeaderBtnAccentClasses,
	ugsHubHeaderBtnClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubToolbarSelectionClasses,
} from '../ugsHubSharedUi';

export interface UgsHubTasksToolbarProps {
	filteredCount: number;
	totalCount: number;
	selectedCount: number;
	bulkActionMode: boolean;
	onExportJson: () => void;
	onExportCsv: () => void;
	onBulkRetry: () => void;
	onBulkDelete: () => void;
	onClearSelection: () => void;
	onToggleBulkMode: () => void;
}

export const UgsHubTasksToolbar: FC<UgsHubTasksToolbarProps> = ({
	filteredCount,
	totalCount,
	selectedCount,
	bulkActionMode,
	onExportJson,
	onExportCsv,
	onBulkRetry,
	onBulkDelete,
	onClearSelection,
	onToggleBulkMode,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const btn = cn(ugsHubHeaderBtnClasses(theme), 'text-xs');
	const bulkBtn = cn(
		btn,
		bulkActionMode && ugsHubHeaderBtnAccentClasses(theme)
	);

	return (
		<div
			className={cn(
				'mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--desktop-border-subtle) pt-3 text-xs',
				ugsHubTextMuted(theme)
			)}
		>
			<span>
				<span className={cn('font-medium', ugsHubTextPrimary(theme))}>
					{t('toolbar.filtered', {
						filtered: filteredCount,
						total: totalCount,
					})}
				</span>
				{selectedCount > 0 ? (
					<span className={cn('ml-3', ugsHubToolbarSelectionClasses(theme))}>
						{t('toolbar.selected', { count: selectedCount })}
					</span>
				) : null}
			</span>
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" onClick={onExportJson} className={btn}>
					<ArrowDownTrayIcon
						className="h-3.5 w-3.5"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					JSON
				</button>
				<button type="button" onClick={onExportCsv} className={btn}>
					<ArrowDownTrayIcon
						className="h-3.5 w-3.5"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					CSV
				</button>
				{selectedCount > 0 ? (
					<>
						<button type="button" onClick={onBulkRetry} className={btn}>
							<ArrowPathIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('toolbar.bulkRetry', { count: selectedCount })}
						</button>
						<button type="button" onClick={onBulkDelete} className={btn}>
							<XMarkIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('toolbar.bulkDelete', { count: selectedCount })}
						</button>
						<button type="button" onClick={onClearSelection} className={btn}>
							{t('toolbar.clearSelection')}
						</button>
					</>
				) : (
					<button type="button" onClick={onToggleBulkMode} className={bulkBtn}>
						<FunnelIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{bulkActionMode
							? t('toolbar.bulkModeOn')
							: t('toolbar.bulkModeOff')}
					</button>
				)}
			</div>
		</div>
	);
};
