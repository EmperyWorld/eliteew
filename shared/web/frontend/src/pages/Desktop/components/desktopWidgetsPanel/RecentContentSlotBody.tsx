/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Recent content widget slot listing recently opened files.
 *
 * Invariants:
 * - Row count capped by compact mode (3 vs 6).
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { NewspaperIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { DesktopWidgetsPanelProps } from './types';

export function RecentContentSlotBody({
	compact,
	recentOpened,
	onOpenRecentFile,
}: Pick<DesktopWidgetsPanelProps, 'recentOpened' | 'onOpenRecentFile'> & {
	compact: boolean;
}) {
	const { t } = useTranslation('desktopUi');
	const rows = compact ? recentOpened.slice(0, 3) : recentOpened.slice(0, 6);
	if (rows.length === 0) {
		return (
			<p className={DESKTOP_TYPOGRAPHY.caption}>
				{t('settingsPanel.widgetsPanel.recentEmpty')}
			</p>
		);
	}
	return (
		<ul className="space-y-0.5">
			{rows.map((f) => (
				<li key={f.id}>
					<DesktopChromeTooltip
						content={f.name}
						placement="top"
						offsetExtra={4}
					>
						<button
							type="button"
							onClick={() => onOpenRecentFile(f)}
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-(--desktop-text-secondary) transition-colors',
								'hover:bg-(--desktop-surface-soft) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
							)}
						>
							<NewspaperIcon
								className="h-3.5 w-3.5 shrink-0 opacity-70"
								aria-hidden
							/>
							<span className="min-w-0 truncate">{f.name}</span>
						</button>
					</DesktopChromeTooltip>
				</li>
			))}
		</ul>
	);
}
