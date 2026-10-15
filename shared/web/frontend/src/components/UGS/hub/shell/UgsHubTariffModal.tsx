/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tariff table modal grouped by product area (energy cost per generation type).
 *
 * Related:
 * - utils/ugsGenerationProductArea.ts, ugsHubSharedUi.tsx
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { GenerationType } from '../../../../hooks/api/useUgsDashboard';
import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { cn } from '../../../../utils/cn';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../../../utils/ugsHumanizeTypeKey';
import {
	UgsHubModalFrame,
	ugsHubHeaderBtnClasses,
	ugsHubModalDividerClasses,
	ugsHubModalTableHeadClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '../ugsHubSharedUi';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';

export type UgsHubTariffGroup = {
	areaId: string;
	label: string;
	types: GenerationType[];
};

export interface UgsHubTariffModalProps {
	groups: UgsHubTariffGroup[];
	backdropZ: number;
	contentZ: number;
	onClose: () => void;
}

export const UgsHubTariffModal: FC<UgsHubTariffModalProps> = ({
	groups,
	backdropZ,
	contentZ,
	onClose,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	return (
		<UgsHubModalFrame
			backdropZ={backdropZ}
			contentZ={contentZ}
			onClose={onClose}
			maxWidthClass="max-w-3xl"
			maxHeightClass="max-h-[85vh]"
			bodyClassName="space-y-6"
			header={
				<div className="flex items-center justify-between gap-4">
					<div>
						<p
							className={cn(
								'text-xs uppercase tracking-[0.25em]',
								ugsHubTextMuted(theme)
							)}
						>
							{t('tariffModal.eyebrow')}
						</p>
						<h2
							className={cn('text-lg font-semibold', ugsHubTextPrimary(theme))}
						>
							{t('tariffModal.title')}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className={ugsHubHeaderBtnClasses(theme)}
						aria-label={t('common.closeAria')}
					>
						<XMarkIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</button>
				</div>
			}
		>
			{groups.map((group) => (
				<div key={group.areaId} className="space-y-3">
					<h3 className={cn('text-sm font-semibold', ugsHubTextPrimary(theme))}>
						{t(`productArea.${group.areaId}`, {
							defaultValue: group.label,
						})}
					</h3>
					<div
						className={cn(
							'overflow-hidden rounded-xl border',
							ugsHubModalDividerClasses(theme)
						)}
					>
						<table className="min-w-full text-left text-sm">
							<thead className={ugsHubModalTableHeadClasses(theme)}>
								<tr>
									<th className="px-3 py-2 font-medium">
										{t('tariffModal.colType')}
									</th>
									<th className="px-3 py-2 font-medium">
										{t('tariffModal.colEnergy')}
									</th>
									<th className="px-3 py-2 font-medium">
										{t('tariffModal.colEta')}
									</th>
								</tr>
							</thead>
							<tbody>
								{group.types.map((type) => (
									<tr
										key={type.type_key}
										className={cn(
											'border-t',
											ugsHubModalDividerClasses(theme),
											ugsHubTextSecondary(theme)
										)}
									>
										<td className="px-3 py-2">
											{type.display_name || humanizeTypeKey(type.type_key)}
										</td>
										<td className="px-3 py-2 tabular-nums">
											{type.cost_credits ?? '—'}
										</td>
										<td className="px-3 py-2 tabular-nums">
											{type.estimated_time ?? '—'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			))}
		</UgsHubModalFrame>
	);
};
