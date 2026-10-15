/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick-launch grid of popular generation types on Hub overview tab.
 *
 * Invariants:
 * - No navigate-away «all types» CTA (admin Dashboard was a rival surface).
 *
 * Related:
 * - ugsHubSharedUi.tsx, UGSHub.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { GenerationType } from '../../../../hooks/api/useUgsDashboard';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../../pages/Desktop/components/DesktopAppChrome';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../../../utils/ugsHumanizeTypeKey';
import { cn } from '../../../../utils/cn';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubIconTileSmClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '../ugsHubSharedUi';
import { getUgsHubTaskIcon } from './getUgsHubTaskIcon';

export interface UgsHubQuickLaunchSectionProps {
	types: GenerationType[];
	onOpenType: (type: GenerationType) => void;
}

export const UgsHubQuickLaunchSection: FC<UgsHubQuickLaunchSectionProps> = ({
	types,
	onOpenType,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	if (types.length === 0) return null;

	return (
		<section className="mb-8" data-ugs-hub-guide="quick-launch">
			<div className="mb-3">
				<h2 className={cn('text-lg font-semibold', ugsHubTextPrimary(theme))}>
					{t('quickLaunch.title')}
				</h2>
				<p className={cn('text-sm', ugsHubTextMuted(theme))}>
					{t('quickLaunch.subtitle')}
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{types.map((type) => {
					const displayName =
						type.display_name || humanizeTypeKey(type.type_key);
					return (
						<button
							key={type.type_key}
							type="button"
							data-testid={`ugs-hub-quick-launch-${type.type_key}`}
							onClick={() => onOpenType(type)}
							className={cn(
								ugsHubPanelClasses(theme),
								'p-3 text-left transition motion-safe:hover:-translate-y-px',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							<div className="mb-2 flex items-start justify-between gap-2">
								<span className={ugsHubIconTileSmClasses(theme)}>
									{getUgsHubTaskIcon(type.type_key)}
								</span>
								{type.cost_credits != null ? (
									<span
										className={cn(
											'text-[10px] tabular-nums',
											ugsHubTextMuted(theme)
										)}
									>
										{type.cost_credits} ⚡
									</span>
								) : null}
							</div>
							<p
								className={cn(
									'line-clamp-2 text-sm font-medium',
									ugsHubTextPrimary(theme)
								)}
							>
								{displayName}
							</p>
							{type.description ? (
								<p
									className={cn(
										'mt-1 line-clamp-2 text-xs',
										ugsHubTextSecondary(theme)
									)}
								>
									{type.description}
								</p>
							) : null}
						</button>
					);
				})}
			</div>
		</section>
	);
};
