/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub shell header: hero title, connection status, provider health strip.
 * Analytics is a secondary text action under refresh (not a rival Dashboard CTA).
 *
 * Related:
 * - components/UGSHub.tsx, ugsHubSharedUi.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProviderHealth } from '../../../../hooks/api/useUgsDashboard';
import { UGS_WORKSPACE_SEMANTIC } from '../../../../features/ugs/shared/ugsDesktopUi';
import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import type { NavigationHandler } from '../../../../types/navigation';
import { ugsProviderDisplayLabel } from '../../../../utils/ugsProviderDisplayLabel';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubHeaderBtnClasses,
	ugsHubInsetRowClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '../ugsHubSharedUi';
import { cn, formatRelativeTime } from '../utils/ugsHubFormatting';

export interface UgsHubShellHeaderProps {
	onNavigate?: NavigationHandler;
	isOnline: boolean;
	updateIndicator: boolean;
	pollIntervalSeconds: number | null;
	lastUpdated: Date | null | undefined;
	isBusy: boolean;
	onManualRefresh: () => void;
	providerHealth: ProviderHealth[];
}

export const UgsHubShellHeader: FC<UgsHubShellHeaderProps> = ({
	onNavigate,
	isOnline,
	updateIndicator,
	pollIntervalSeconds,
	lastUpdated,
	isBusy,
	onManualRefresh,
	providerHealth,
}) => {
	const { t, i18n } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const [showAllProviders, setShowAllProviders] = useState(false);
	const degradedProviders = providerHealth.filter(
		(provider) => provider.status !== 'healthy'
	);
	const healthyCount = providerHealth.filter(
		(p) => p.status === 'healthy'
	).length;
	const visibleProviders = showAllProviders
		? providerHealth
		: providerHealth.slice(0, 3);
	const degradedSummary = degradedProviders
		.map((provider) => {
			const label = ugsProviderDisplayLabel(
				provider.display_label,
				undefined,
				provider.provider_name
			);
			const error = typeof provider.error === 'string' ? provider.error : null;
			return error ? `${label}: ${error}` : label;
		})
		.join(' | ');

	return (
		<header className="mb-8" data-ugs-hub-guide="header">
			<motion.div
				initial={{ opacity: 0, y: -12 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
			>
				<div className="min-w-0">
					<h1
						className={cn(
							'text-3xl font-bold tracking-tight md:text-4xl',
							ugsHubTextPrimary(theme)
						)}
					>
						{t('shell.title')}
					</h1>
					<p
						className={cn(
							'mt-2 max-w-2xl text-sm leading-relaxed md:text-base',
							ugsHubTextSecondary(theme)
						)}
					>
						{t('shell.subtitle')}
					</p>
				</div>

				<div className="flex w-full flex-col gap-3 md:max-w-sm">
					<div className={cn(ugsHubPanelClasses(theme), 'p-4')}>
						<div
							className={cn(
								'mb-2 flex items-center justify-between text-xs',
								ugsHubTextMuted(theme)
							)}
						>
							<span>{t('shell.connectionStatus')}</span>
							<span>
								{pollIntervalSeconds != null
									? t('shell.pollInterval', {
											seconds: `${pollIntervalSeconds}s`,
										})
									: t('shell.pollUnknown')}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<div className="flex min-w-0 items-center gap-3">
								<span
									className={cn(
										'h-2.5 w-2.5 shrink-0 rounded-full',
										isOnline
											? cn(
													UGS_WORKSPACE_SEMANTIC.successDot,
													'shadow-[0_0_10px_rgba(16,185,129,0.45)]'
												)
											: cn(
													UGS_WORKSPACE_SEMANTIC.dangerDot,
													'shadow-[0_0_10px_rgba(244,63,94,0.45)]'
												),
										updateIndicator &&
											'animate-pulse motion-reduce:animate-none'
									)}
									aria-hidden
								/>
								<div className="min-w-0">
									<p
										className={cn(
											'text-sm font-medium',
											ugsHubTextPrimary(theme)
										)}
									>
										{isOnline ? t('shell.apiOnline') : t('shell.apiOffline')}
									</p>
									<p className={cn('text-xs', ugsHubTextMuted(theme))}>
										{lastUpdated
											? t('shell.updated', {
													time: formatRelativeTime(lastUpdated.toISOString(), {
														locale: i18n.language,
														emptyLabel: t('formatting.noData'),
													}),
												})
											: t('shell.updatedUnknown')}
									</p>
								</div>
							</div>
							<div className="flex shrink-0 flex-col items-end gap-1">
								<button
									type="button"
									onClick={onManualRefresh}
									disabled={isBusy}
									className={cn(
										ugsHubHeaderBtnClasses(theme),
										isBusy && 'cursor-progress opacity-60'
									)}
								>
									<ArrowPathIcon
										className={cn(
											'h-4 w-4',
											isBusy && 'animate-spin motion-reduce:animate-none'
										)}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('shell.refresh')}
								</button>
								{onNavigate ? (
									<button
										type="button"
										onClick={() => onNavigate('ugs-analytics')}
										className={cn(
											'text-xs font-medium underline-offset-4 hover:underline',
											ugsHubTextMuted(theme)
										)}
									>
										{t('shell.analyticsLink')}
									</button>
								) : null}
							</div>
						</div>
					</div>

					{providerHealth.length > 0 ? (
						<div className={cn(ugsHubPanelClasses(theme), 'p-4')}>
							<div
								className={cn(
									'mb-2 flex items-center justify-between text-xs',
									ugsHubTextMuted(theme)
								)}
							>
								<span className={cn('font-medium', ugsHubTextSecondary(theme))}>
									{t('shell.channelsTitle')}
								</span>
								<span className={cn('tabular-nums', ugsHubTextMuted(theme))}>
									{t('shell.channelsOk', {
										healthy: healthyCount,
										total: providerHealth.length,
									})}
								</span>
							</div>
							{degradedProviders.length > 0 ? (
								<div
									className={cn(
										'mb-2 flex items-center justify-between gap-2 text-xs',
										UGS_WORKSPACE_SEMANTIC.warningBanner
									)}
									data-testid="ugs-hub-provider-alert"
									title={degradedSummary}
								>
									<span>
										{t('shell.channelsDegraded', {
											count: degradedProviders.length,
										})}
									</span>
									{onNavigate ? (
										<button
											type="button"
											onClick={() => onNavigate('ugs-admin')}
											className={cn(
												ugsHubHeaderBtnClasses(theme),
												'px-2 py-1 text-[11px]'
											)}
										>
											{t('shell.adminShortcut')}
										</button>
									) : null}
								</div>
							) : null}
							<div className="space-y-2">
								{visibleProviders.map((provider) => (
									<div
										key={provider.provider_name}
										className={ugsHubInsetRowClasses(theme)}
									>
										<div className="min-w-0">
											<p
												className={cn(
													'truncate text-sm',
													ugsHubTextPrimary(theme)
												)}
											>
												{ugsProviderDisplayLabel(
													provider.display_label,
													undefined,
													provider.provider_name
												)}
											</p>
											<p className={cn('text-xs', ugsHubTextMuted(theme))}>
												{provider.response_time != null
													? t('shell.ms', {
															ms: provider.response_time.toFixed(0),
														})
													: '—'}
											</p>
										</div>
										<span
											className={cn(
												'h-2 w-2 shrink-0 rounded-full',
												provider.status === 'healthy' &&
													UGS_WORKSPACE_SEMANTIC.successDot,
												provider.status === 'degraded' &&
													UGS_WORKSPACE_SEMANTIC.warningDot,
												provider.status === 'unhealthy' &&
													UGS_WORKSPACE_SEMANTIC.dangerDot,
												provider.status !== 'healthy' &&
													provider.status !== 'degraded' &&
													provider.status !== 'unhealthy' &&
													UGS_WORKSPACE_SEMANTIC.dangerDot
											)}
											aria-hidden
										/>
									</div>
								))}
							</div>
							{providerHealth.length > 3 ? (
								<button
									type="button"
									onClick={() => setShowAllProviders((v) => !v)}
									className={cn(
										'mt-2 w-full text-center text-xs',
										ugsHubTextMuted(theme),
										'transition hover:text-(--desktop-text-primary)'
									)}
								>
									{showAllProviders
										? t('shell.providersCollapse')
										: t('shell.providersExpand', {
												count: providerHealth.length,
											})}
								</button>
							) : null}
						</div>
					) : null}
				</div>
			</motion.div>
		</header>
	);
};
