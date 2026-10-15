/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grouped sidebar navigation for unified admin (collapse, mobile drawer, footer actions).
 *
 * Invariants:
 * - Section list is driven only by `adminShellConfig` (no duplicate nav arrays).
 * - Collapsed desktop mode shows icons with `title` tooltips for labels.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/UnifiedAdminPage.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { BackToDesktopButton } from '@/components/ui/BackToDesktopButton';
import type { NavigationHandler } from '@/types/navigation';
import { cn } from '@/utils/cn';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	ADMIN_SHELL_NAV_GROUPS,
	listAdminShellSectionsByGroup,
	type AdminSectionId,
} from './adminShellConfig';
import { resolveAdminNavGroupLabel } from './adminShellLabels';
import type { AdminShellNavBadges } from './useAdminShellNavBadges';

export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'eliteew.admin.sidebar_collapsed';

interface AdminShellSidebarProps {
	section: AdminSectionId;
	onSectionChange: (id: AdminSectionId) => void;
	collapsed: boolean;
	onCollapsedChange: (collapsed: boolean) => void;
	isMobile: boolean;
	isOverlay?: boolean;
	onNavigate?: NavigationHandler;
	onRequestClose?: () => void;
	userLabel?: string | null;
	navBadges?: AdminShellNavBadges;
}

function formatNavBadgeCount(n: number | null | undefined): string | null {
	if (n == null || !Number.isFinite(n) || n <= 0) return null;
	return n > 99 ? '99+' : String(n);
}

function resolveDynamicNavBadge(
	sectionId: AdminSectionId,
	navBadges: AdminShellNavBadges | undefined
): string | null {
	if (!navBadges) return null;
	if (sectionId === 'feedback') {
		return formatNavBadgeCount(navBadges.feedbackOpen);
	}
	if (sectionId === 'socialReports') {
		return formatNavBadgeCount(navBadges.socialReportsOpen);
	}
	if (sectionId === 'users') {
		return formatNavBadgeCount(navBadges.usersOnline);
	}
	return null;
}

function resolveSectionLabel(
	label: string,
	labelI18nKey: string | undefined,
	t: (key: string) => string
): string {
	if (labelI18nKey) {
		return t(labelI18nKey);
	}
	return label;
}

export function AdminShellSidebar({
	section,
	onSectionChange,
	collapsed,
	onCollapsedChange,
	isMobile,
	isOverlay = false,
	onNavigate,
	onRequestClose,
	userLabel,
	navBadges,
}: AdminShellSidebarProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const showLabels = !collapsed || isMobile;

	const toggleCollapsed = () => {
		const next = !collapsed;
		onCollapsedChange(next);
		try {
			localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(next));
		} catch {
			/* ignore */
		}
	};

	return (
		<aside
			className={cn(
				'eliteew-admin-shell__sidebar flex h-full flex-col text-white',
				!isMobile && collapsed && 'eliteew-admin-shell__sidebar--collapsed',
				isOverlay && 'shadow-2xl'
			)}
			aria-label={t('adminShell.navAria')}
		>
			<div
				className={cn(
					'flex items-center gap-2 border-b border-white/10 px-3 py-3',
					showLabels ? 'justify-between' : 'justify-center'
				)}
			>
				{showLabels ? (
					<div className="flex min-w-0 items-center gap-2.5">
						<div
							className="eliteew-admin-shell__brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
							aria-hidden
						>
							<Squares2X2Icon className="h-5 w-5 text-violet-200" />
						</div>
						<div className="min-w-0">
							<div className={DESKTOP_TYPOGRAPHY.title}>
								{t('adminShell.brandTitle')}
							</div>
							<p className="truncate text-[11px] text-slate-400">
								{t('adminShell.brandSubtitle')}
							</p>
						</div>
					</div>
				) : (
					<div
						className="eliteew-admin-shell__brand-mark flex h-9 w-9 items-center justify-center rounded-lg"
						title={t('adminShell.brandPanelTitle')}
					>
						<Squares2X2Icon className="h-5 w-5 text-violet-200" />
					</div>
				)}
				{!isMobile ? (
					<button
						type="button"
						onClick={toggleCollapsed}
						className={cn(
							'shrink-0 p-2 text-slate-400',
							DESKTOP_SURFACE.radius,
							DESKTOP_INTERACTIVE.btnRounded
						)}
						aria-label={
							collapsed
								? t('adminShell.expandMenu')
								: t('adminShell.collapseMenu')
						}
						title={
							collapsed
								? t('adminShell.expandMenu')
								: t('adminShell.collapseMenu')
						}
					>
						{collapsed ? (
							<ChevronRightIcon className="h-5 w-5" />
						) : (
							<ChevronLeftIcon className="h-5 w-5" />
						)}
					</button>
				) : null}
			</div>

			<nav className="flex flex-1 flex-col gap-3 overflow-auto px-2 py-3">
				{ADMIN_SHELL_NAV_GROUPS.map((group) => {
					const items = listAdminShellSectionsByGroup(group.id);
					return (
						<div key={group.id} className="flex flex-col gap-0.5">
							{showLabels ? (
								<div className="eliteew-admin-shell__nav-group-label px-2 pb-1 pt-1">
									{resolveAdminNavGroupLabel(group.id, t)}
								</div>
							) : null}
							{items.map((item) => {
								const displayLabel = resolveSectionLabel(
									item.label,
									item.labelI18nKey,
									t
								);
								const Icon = item.icon;
								const active = section === item.id;
								const dynamicBadge = resolveDynamicNavBadge(item.id, navBadges);
								return (
									<button
										key={item.id}
										type="button"
										data-nav-section={item.id}
										onClick={() => onSectionChange(item.id)}
										className={cn(
											'eliteew-admin-shell__nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
											DESKTOP_INTERACTIVE.rowInteractive,
											'motion-reduce:transition-none',
											active
												? 'eliteew-admin-shell__nav-item--active'
												: 'text-slate-400 hover:bg-white/5 hover:text-white',
											!showLabels && 'justify-center px-2'
										)}
										title={!showLabels ? displayLabel : undefined}
										aria-current={active ? 'page' : undefined}
									>
										<Icon className="h-5 w-5 shrink-0" aria-hidden />
										{showLabels ? (
											<span className="flex min-w-0 flex-1 items-center gap-2">
												<span className="truncate">{displayLabel}</span>
												{item.badge ? (
													<span className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
														{item.badge}
													</span>
												) : null}
												{dynamicBadge ? (
													<span className="eliteew-admin-shell__nav-badge shrink-0 tabular-nums">
														{dynamicBadge}
													</span>
												) : null}
											</span>
										) : null}
									</button>
								);
							})}
						</div>
					);
				})}
			</nav>

			<div className="space-y-2 border-t border-white/10 px-2 py-3">
				{onRequestClose && showLabels ? (
					<button
						type="button"
						onClick={onRequestClose}
						className={cn(
							'inline-flex w-full items-center justify-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm text-white',
							DESKTOP_SURFACE.radius,
							DESKTOP_INTERACTIVE.btnRounded,
							'hover:bg-white/10'
						)}
					>
						<Squares2X2Icon className="h-4 w-4" aria-hidden />
						{t('adminShellGate.backToDesktop')}
					</button>
				) : null}
				{!onRequestClose && onNavigate && showLabels ? (
					<BackToDesktopButton
						onNavigate={onNavigate}
						className="w-full justify-center"
					/>
				) : null}
				{showLabels && userLabel ? (
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.small,
							'truncate px-1 text-slate-500'
						)}
						title={userLabel}
					>
						{userLabel}
					</div>
				) : null}
			</div>
		</aside>
	);
}
