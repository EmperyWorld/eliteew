/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact skeleton for UGS Dashboard/Analytics while data loads.
 *
 * Related:
 * - components/UGS/workspace/UgsWorkspaceShell.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import {
	ugsHubPanelClasses,
	ugsHubSkeletonBlockClasses,
} from '@/components/UGS/hub/ugsHubSharedUi';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { cn } from '@/utils/cn';

export interface UgsWorkspaceLoadingProps {
	theme: DesktopShellTheme;
	kpiCount?: number;
	className?: string;
}

export const UgsWorkspaceLoading: FC<UgsWorkspaceLoadingProps> = ({
	theme,
	kpiCount = 6,
	className,
}) => {
	const { t } = useTranslation('ugsHub');
	const pulse = 'animate-pulse motion-reduce:animate-none';
	const block = ugsHubSkeletonBlockClasses(theme);
	const kpiKeys = Array.from({ length: kpiCount }, (_, i) => `kpi-${i}`);

	return (
		<div
			className={cn('space-y-6', className)}
			role="status"
			aria-busy="true"
			aria-live="polite"
			data-testid="ugs-workspace-loading"
		>
			<span className="sr-only">{t('workspace.loadingSrOnly')}</span>
			<div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', pulse)}>
				{kpiKeys.map((key) => (
					<div key={key} className={cn(ugsHubPanelClasses(theme), 'h-28')} />
				))}
			</div>
			<div className={cn('grid min-w-0 gap-6 xl:grid-cols-2', pulse)}>
				<div className={cn(ugsHubPanelClasses(theme), 'h-64')} />
				<div className={cn(ugsHubPanelClasses(theme), 'h-64')} />
			</div>
			<div className={cn(ugsHubPanelClasses(theme), pulse, 'h-40')}>
				<div className={cn('mx-4 mt-4 h-4 w-40', block)} />
				<div className={cn('mx-4 mt-6 space-y-3')}>
					{(['row-a', 'row-b', 'row-c'] as const).map((key) => (
						<div key={key} className={cn('h-10 w-full', block)} />
					))}
				</div>
			</div>
		</div>
	);
};
