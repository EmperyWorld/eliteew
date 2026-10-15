/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared KPI/stat tile for UGS Dashboard and Analytics workspace views.
 *
 * Related:
 * - features/ugs/shared/ugsDesktopUi.ts
 * - components/UGS/workspace/UgsWorkspaceShell.tsx
 */

import type { FC, ReactNode } from 'react';
import type { SVGProps } from 'react';

import {
	ugsHubIconTileClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from '@/components/UGS/hub/ugsHubSharedUi';
import {
	UGS_WORKSPACE_SEMANTIC,
	ugsWorkspaceMetricCardClass,
} from '@/features/ugs/shared/ugsDesktopUi';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

type MetricIcon = FC<SVGProps<SVGSVGElement>>;

export type UgsMetricAccent = 'default' | 'success' | 'warning' | 'danger';

export interface UgsMetricCardProps {
	theme: DesktopShellTheme;
	label: string;
	value: ReactNode;
	hint?: string;
	icon: MetricIcon;
	accent?: UgsMetricAccent;
	className?: string;
}

const ACCENT_ICON: Record<Exclude<UgsMetricAccent, 'default'>, string> = {
	success: UGS_WORKSPACE_SEMANTIC.success,
	warning: UGS_WORKSPACE_SEMANTIC.warning,
	danger: UGS_WORKSPACE_SEMANTIC.danger,
};

export const UgsMetricCard: FC<UgsMetricCardProps> = ({
	theme,
	label,
	value,
	hint,
	icon: Icon,
	accent = 'default',
	className,
}) => {
	const iconAccent = accent === 'default' ? undefined : ACCENT_ICON[accent];

	return (
		<div className={cn(ugsWorkspaceMetricCardClass, className)}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							'text-xs font-medium uppercase tracking-wide',
							ugsHubTextMuted(theme)
						)}
					>
						{label}
					</p>
					<p
						className={cn(
							'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
							iconAccent ?? ugsHubTextPrimary(theme)
						)}
					>
						{value}
					</p>
					{hint ? (
						<p
							className={cn(
								'mt-2 text-xs leading-relaxed',
								ugsHubTextMuted(theme)
							)}
						>
							{hint}
						</p>
					) : null}
				</div>
				<div className={ugsHubIconTileClasses(theme)}>
					<Icon
						className={cn('h-5 w-5', iconAccent ?? ugsHubTextMuted(theme))}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</div>
			</div>
		</div>
	);
};
