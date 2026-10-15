/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared chrome for UGS Dashboard and Analytics inside the desktop UGS window.
 *
 * Related:
 * - components/UGSDashboard.tsx, pages/UGSAnalytics.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { UgsHubShellThemeProvider } from '@/components/UGS/hub/ugsHubShellThemeContext';
import {
	ugsHubHeaderBtnClasses,
	ugsHubPanelClasses,
	ugsHubRootClasses,
	ugsHubRootGlowClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '@/components/UGS/hub/ugsHubSharedUi';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { cn } from '@/utils/cn';

export interface UgsWorkspaceShellProps {
	title: string;
	subtitle: string;
	isFetching?: boolean;
	lastUpdated?: Date | null;
	onRefresh?: () => void;
	headerActions?: ReactNode;
	children: ReactNode;
	rootId?: string;
	'data-testid'?: string;
}

export const UgsWorkspaceShell: FC<UgsWorkspaceShellProps> = ({
	title,
	subtitle,
	isFetching = false,
	lastUpdated,
	onRefresh,
	headerActions,
	children,
	rootId,
	'data-testid': testId,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useDesktopShellTheme();

	return (
		<UgsHubShellThemeProvider value={theme}>
			<div
				id={rootId}
				className={cn(ugsHubRootClasses(theme), 'min-h-full')}
				data-testid={testId}
			>
				<div className={ugsHubRootGlowClasses(theme)} />
				<div className="relative z-10 flex min-h-full flex-col px-4 py-6 sm:px-6 lg:px-8">
					<header className="mb-6 shrink-0" data-ugs-dashboard-guide="header">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div className="min-w-0 space-y-1">
								<p className={DESKTOP_TYPOGRAPHY.labelOverline}>UGS</p>
								<h1
									className={cn(
										'text-xl font-semibold tracking-tight sm:text-2xl',
										ugsHubTextPrimary(theme)
									)}
								>
									{title}
								</h1>
								<p
									className={cn(
										'max-w-2xl text-sm',
										ugsHubTextSecondary(theme)
									)}
								>
									{subtitle}
								</p>
								{lastUpdated ? (
									<p className={cn('text-xs', ugsHubTextMuted(theme))}>
										{t('workspace.updatedAt', {
											time: lastUpdated.toLocaleTimeString(),
										})}
										{isFetching ? (
											<span className="ml-2 inline-flex items-center gap-1.5 text-(--desktop-text-secondary)">
												<span
													className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] motion-reduce:animate-none"
													aria-hidden
												/>
												{t('workspace.refreshing')}
											</span>
										) : null}
									</p>
								) : isFetching ? (
									<p className={cn('text-xs', ugsHubTextMuted(theme))}>
										<span className="inline-flex items-center gap-1.5">
											<span
												className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] motion-reduce:animate-none"
												aria-hidden
											/>
											{t('workspace.refreshing')}
										</span>
									</p>
								) : null}
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{headerActions}
								{onRefresh ? (
									<button
										type="button"
										onClick={onRefresh}
										disabled={isFetching}
										className={cn(
											ugsHubHeaderBtnClasses(theme),
											'inline-flex min-h-10 items-center gap-2 px-3',
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
									>
										<ArrowPathIcon
											className={cn(
												'h-4 w-4',
												isFetching && 'animate-spin motion-reduce:animate-none'
											)}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('workspace.refresh')}
									</button>
								) : null}
							</div>
						</div>
					</header>
					<div className="min-h-0 flex-1 space-y-6">{children}</div>
				</div>
			</div>
		</UgsHubShellThemeProvider>
	);
};

export function ugsWorkspacePanel(
	theme: ReturnType<typeof useDesktopShellTheme>,
	className?: string
): string {
	return ugsHubPanelClasses(theme, className);
}
