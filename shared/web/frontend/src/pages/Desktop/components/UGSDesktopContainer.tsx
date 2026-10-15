/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single desktop window for UGS: Hub (primary work), Analytics, and admin tools without route churn.
 *
 * Invariants:
 * - Admin subview loads `features/ugs/admin-v2/UGSAdminV2Panel` only when `hasUgsAdminIdentity` is true.
 * - Toolbar IA: primary tabs Hub + Analytics; operator Dashboard/Admin (and Builder when open) are secondary.
 * - Never render workspaceOverline in this toolbar — WindowTitleBar owns branding.
 * - Lazy chunks stay stable; UGS Admin path is the v2 feature module.
 * - In-app toolbar shows current view label only — catalog/app title stays on WindowTitleBar (no «UGS Workspace» overline).
 *
 * Related:
 * - src/features/ugs/admin-v2/UGSAdminV2Panel.tsx
 * - src/components/UGSHub.tsx
 * - documentation/product/desktop/UGS-DESKTOP-SHELL.md
 * - DesktopChromeTooltip.tsx
 */

import * as React from 'react';
import { useCallback, useState, Suspense, lazy } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useDesktopShellTheme } from '../../../hooks/useDesktopShellTheme';
import { hasUgsAdminIdentity } from '../../../utils/ugsAdminAccess';
import type { NavigationHandler } from '../../../types/navigation';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../constants';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppStatusBadge,
	DesktopAppToolbar,
} from './DesktopAppChrome';
import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import { UgsHubShellThemeProvider } from '../../../components/UGS/hub/ugsHubShellThemeContext';
import UGSHub from '../../../components/UGSHub';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const UGSDashboardLazy = lazy(() => import('../../../components/UGSDashboard'));
const UGSAnalyticsLazy = lazy(() => import('../../UGSAnalytics'));
const UGSAdminV2PanelLazy = lazy(
	() => import('../../../features/ugs/admin-v2/UGSAdminV2Panel')
);

type UGSView = 'hub' | 'dashboard' | 'analytics' | 'admin';

/** User work surface — always in the primary tablist. */
const UGS_PRIMARY_VIEWS = ['hub', 'analytics'] as const;
/** Operator tools — admin-only, secondary tablist (not rival Hub CTAs). */
const UGS_OPERATOR_VIEWS = ['dashboard', 'admin'] as const;

/** Suspense fallback for lazy UGS views — a11y + tokens aligned with desktop shell. */
export function UGSDesktopSuspenseFallback(): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ugsDesktop' });
	return (
		<div
			className="flex h-full min-h-[200px] items-center justify-center bg-transparent"
			role="status"
			aria-busy="true"
			aria-label={t('suspenseLoadingAria')}
			data-testid="ugs-desktop-suspense-fallback"
		>
			<ArrowPathIcon
				className="h-8 w-8 shrink-0 animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
				strokeWidth={DESKTOP_LUCIDE.stroke}
				aria-hidden
			/>
		</div>
	);
}

export interface UGSDesktopContainerProps {
	onNavigate?: NavigationHandler;
	initialView?: UGSView;
}

export const UGSDesktopContainer: React.FC<UGSDesktopContainerProps> = ({
	onNavigate,
	initialView = 'hub',
}) => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ugsDesktop' });
	const { user } = useAuth();
	const isUgsAdmin = hasUgsAdminIdentity(user);
	const viewLabel = useCallback(
		(nextView: UGSView) => t(`views.${nextView}`),
		[t]
	);
	const viewTooltip = useCallback(
		(nextView: UGSView) => t(`viewTooltips.${nextView}`),
		[t]
	);
	const [view, setView] = useState<UGSView>(initialView);
	const shellTheme = useDesktopShellTheme();

	React.useEffect(() => {
		setView(initialView);
	}, [initialView]);

	React.useEffect(() => {
		if (!isUgsAdmin && (view === 'admin' || view === 'dashboard')) {
			setView('hub');
		}
	}, [isUgsAdmin, view]);

	const handleInAppNavigate = useCallback(
		(page: string) => {
			if (page === 'ugs-hub') {
				setView('hub');
				return;
			}
			if (page === 'ugs') {
				setView(isUgsAdmin ? 'dashboard' : 'hub');
				return;
			}
			if (page === 'ugs-analytics') {
				setView('analytics');
				return;
			}
			if (page === 'ugs-admin') {
				setView('admin');
				return;
			}
			onNavigate?.(page);
		},
		[onNavigate, isUgsAdmin]
	);

	return (
		<DesktopAppContentWrapper appComponent="UGS" className="h-full">
			<section
				className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent"
				data-testid="ugs-desktop-container"
				data-ugs-shell-theme={shellTheme}
				data-ugs-view={view}
				aria-label={t('containerAria')}
			>
				<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel)">
					<DesktopAppToolbar className="flex flex-col items-stretch gap-2 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className={cn('min-w-0', DESKTOP_TYPOGRAPHY.subtitle)}>
									{viewLabel(view)}
								</h2>
								<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
									{t('singleWindowBadge')}
								</DesktopAppStatusBadge>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 lg:gap-3">
							<div
								role="tablist"
								aria-label={t('sectionsTablistAria')}
								className="flex flex-wrap items-center gap-2"
								data-testid="ugs-desktop-primary-tabs"
							>
								{UGS_PRIMARY_VIEWS.map((nextView) => (
									<DesktopChromeTooltip
										key={nextView}
										content={viewTooltip(nextView)}
										placement="bottom"
										offsetExtra={6}
									>
										<DesktopAppButton
											type="button"
											role="tab"
											aria-selected={view === nextView}
											variant={view === nextView ? 'accent' : 'ghost'}
											className="min-h-10 px-3"
											onClick={() => setView(nextView)}
										>
											{viewLabel(nextView)}
										</DesktopAppButton>
									</DesktopChromeTooltip>
								))}
							</div>
							{isUgsAdmin ? (
								<>
									<span
										className="hidden h-6 w-px shrink-0 bg-(--desktop-border-subtle) sm:block"
										aria-hidden
									/>
									<div
										role="tablist"
										aria-label={t('operatorToolsTablistAria')}
										className="flex flex-wrap items-center gap-2"
										data-testid="ugs-desktop-operator-tabs"
									>
										{UGS_OPERATOR_VIEWS.map((nextView) => (
											<DesktopChromeTooltip
												key={nextView}
												content={viewTooltip(nextView)}
												placement="bottom"
												offsetExtra={6}
											>
												<DesktopAppButton
													type="button"
													role="tab"
													aria-selected={view === nextView}
													variant={view === nextView ? 'accent' : 'ghost'}
													className="min-h-10 px-3 text-(--desktop-text-secondary)"
													onClick={() => setView(nextView)}
												>
													{viewLabel(nextView)}
												</DesktopAppButton>
											</DesktopChromeTooltip>
										))}
									</div>
								</>
							) : null}
						</div>
					</DesktopAppToolbar>
				</div>
				<div className="min-h-0 flex-1 overflow-auto">
					<UgsHubShellThemeProvider value={shellTheme}>
						<Suspense fallback={<UGSDesktopSuspenseFallback />}>
							{view === 'hub' && <UGSHub onNavigate={handleInAppNavigate} />}
							{view === 'dashboard' && (
								<UGSDashboardLazy onNavigate={handleInAppNavigate} />
							)}
							{view === 'analytics' && (
								<UGSAnalyticsLazy onNavigate={handleInAppNavigate} />
							)}
							{view === 'admin' && isUgsAdmin && <UGSAdminV2PanelLazy />}
						</Suspense>
					</UgsHubShellThemeProvider>
				</div>
			</section>
		</DesktopAppContentWrapper>
	);
};

export default UGSDesktopContainer;
