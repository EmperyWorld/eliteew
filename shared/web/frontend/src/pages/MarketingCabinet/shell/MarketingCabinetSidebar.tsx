/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Primary Marketing Cabinet navigation rail with grouped, marketer-facing sections.
 *
 * Invariants:
 * - Click targets keep stable MarketingView ids for deep links and permissions.
 * - Advanced tools are visually secondary but remain reachable for existing projects and links.
 *
 * Related:
 * - ../constants.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */
import { type FocusEvent, useMemo } from 'react';

import {
	Bars3BottomLeftIcon,
	BookmarkSquareIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { getDesktopShellNavRailClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import {
	DesktopAppButton,
	DesktopAppListRow,
	DesktopAppSectionLabel,
} from '../../Desktop/components/DesktopAppChrome';
import {
	formatMarketingRailSignalCount,
	MARKETING_RAIL_SIGNAL_CLASSNAMES,
} from '../marketingCabinetPageHelpers';
import type { MarketingRailSignal } from '../marketingCabinetPageTypes';
import {
	MARKETING_SIDEBAR_GROUPS,
	type MarketingModuleIcon,
	type MarketingView,
} from '../constants';

export interface MarketingCabinetSidebarModule {
	id: MarketingView;
	icon: MarketingModuleIcon;
}

export type MarketingCabinetSidebarNavLayoutMode =
	| 'floating'
	| 'pinned_expanded'
	| 'icon_rail';

export interface MarketingCabinetSidebarProps {
	isSidebarExpanded: boolean;
	sidebarNavLayoutMode: MarketingCabinetSidebarNavLayoutMode;
	activeView: MarketingView;
	activeModuleTitle: string;
	sidebarModules: MarketingCabinetSidebarModule[];
	railSignals: Partial<Record<MarketingView, MarketingRailSignal>>;
	onCycleSidebarNavLayout: () => void;
	onSelectModule: (id: MarketingView) => void;
	/** K.107: prefetch dashboard bundle when user aims at the Dashboard rail item. */
	onPrefetchInteractiveDashboard?: () => void;
	/** Prefetch AMKA chunk + self-profile before opening the section. */
	onPrefetchAmkaModule?: () => void;
	onNavMouseEnter: () => void;
	onNavMouseLeave: () => void;
	onNavFocusCapture: () => void;
	onNavBlurCapture: (event: FocusEvent<HTMLDivElement>) => void;
	getRailSignalText: (
		view: MarketingView,
		signal?: MarketingRailSignal
	) => string | null;
}

export function MarketingCabinetSidebar({
	isSidebarExpanded,
	sidebarNavLayoutMode,
	activeView,
	activeModuleTitle,
	sidebarModules,
	railSignals,
	onCycleSidebarNavLayout,
	onSelectModule,
	onPrefetchInteractiveDashboard,
	onPrefetchAmkaModule,
	onNavMouseEnter,
	onNavMouseLeave,
	onNavFocusCapture,
	onNavBlurCapture,
	getRailSignalText,
}: MarketingCabinetSidebarProps) {
	const { t } = useTranslation('marketing');
	const shellFrame = useDesktopShellFrame();
	const railShell = getDesktopShellNavRailClassName(shellFrame);

	const navLayoutActive = sidebarNavLayoutMode !== 'floating';
	const navLayoutIsIconRail = sidebarNavLayoutMode === 'icon_rail';
	const navLayoutCycleAria = t(
		`sidebar.navLayoutCycle.${sidebarNavLayoutMode}`
	);
	const NavLayoutIcon = navLayoutIsIconRail
		? Bars3BottomLeftIcon
		: BookmarkSquareIcon;
	const groupedSidebarModules = useMemo(
		() =>
			MARKETING_SIDEBAR_GROUPS.map((group) => ({
				group,
				modules: group.viewIds
					.map((id) => sidebarModules.find((module) => module.id === id))
					.filter((module): module is MarketingCabinetSidebarModule =>
						Boolean(module)
					),
			})).filter((group) => group.modules.length > 0),
		[sidebarModules]
	);

	const sidebarLabelMotion = isSidebarExpanded
		? 'max-w-[220px] opacity-100'
		: 'max-w-0 opacity-0 pointer-events-none';

	const renderModuleRow = (module: MarketingCabinetSidebarModule) => {
		const Icon = module.icon;
		const moduleTitle = t(`modules.${module.id}.title`);
		const moduleDescription = t(`modules.${module.id}.description`);
		const isActive = activeView === module.id;
		const moduleSignal = railSignals[module.id];
		const moduleSignalClasses = moduleSignal
			? MARKETING_RAIL_SIGNAL_CLASSNAMES[moduleSignal.tone]
			: null;
		const prefetchOnAim =
			module.id === 'overview_dashboard'
				? onPrefetchInteractiveDashboard
				: module.id === 'amka'
					? onPrefetchAmkaModule
					: undefined;
		return (
			<li key={module.id} className="list-none">
				<DesktopAppListRow
					active={isActive}
					onClick={() => onSelectModule(module.id)}
					onMouseEnter={prefetchOnAim ? () => prefetchOnAim() : undefined}
					onFocus={prefetchOnAim ? () => prefetchOnAim() : undefined}
					className={cn(
						'relative overflow-hidden rounded-sm border border-transparent transition-all duration-300 ease-out motion-reduce:transition-none',
						isSidebarExpanded
							? 'px-3 py-3'
							: 'mx-auto h-14 w-14 rounded-sm px-0 py-0'
					)}
					aria-label={moduleTitle}
					title={
						isSidebarExpanded
							? undefined
							: [
									moduleTitle,
									moduleDescription,
									getRailSignalText(module.id, moduleSignal),
								]
									.filter(Boolean)
									.join('\n')
					}
				>
					<span
						className={cn(
							'absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-(--mc-accent) transition-opacity duration-200',
							isActive ? 'opacity-100' : 'opacity-0'
						)}
					/>
					<div
						className={cn(
							'flex min-w-0 items-center',
							isSidebarExpanded ? 'gap-3' : 'justify-center'
						)}
					>
						<div
							className={cn(
								'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-(--desktop-radius) border transition-colors',
								isActive
									? 'border-(--mc-accent-35) bg-(--desktop-surface-accent) text-[rgb(var(--desktop-fg-primary-rgb))]'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
							)}
						>
							<Icon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
							{!isSidebarExpanded && moduleSignal && moduleSignalClasses ? (
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full border px-1 font-semibold leading-4 shadow-(--desktop-shadow-soft)',
										moduleSignalClasses.overlay
									)}
								>
									{formatMarketingRailSignalCount(moduleSignal.count)}
								</span>
							) : null}
						</div>
						<div
							className={cn(
								'min-w-0 flex-1 overflow-hidden transition-[opacity,max-width] duration-300 ease-out motion-reduce:transition-none',
								sidebarLabelMotion
							)}
						>
							<div className="mc-display-title truncate text-sm font-medium tracking-wide text-(--desktop-text-primary)">
								{moduleTitle}
							</div>
							<div
								className={cn(
									'mc-body-copy mt-1 line-clamp-2 text-xs leading-5 tracking-wide text-(--desktop-text-muted)'
								)}
							>
								{moduleDescription}
							</div>
						</div>
						{moduleSignal && moduleSignalClasses ? (
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'ml-auto inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full border px-1.5 font-semibold leading-none transition-[opacity,max-width] duration-300 ease-out motion-reduce:transition-none',
									moduleSignalClasses.inline,
									sidebarLabelMotion
								)}
							>
								{formatMarketingRailSignalCount(moduleSignal.count)}
							</span>
						) : null}
					</div>
				</DesktopAppListRow>
			</li>
		);
	};

	return (
		<nav
			data-mc-guide="sidebar"
			className={cn(
				'flex h-full shrink-0 flex-col overflow-hidden shadow-(--mc-nav-rail-inset) transition-[width] duration-300 ease-out motion-reduce:transition-none',
				railShell,
				isSidebarExpanded ? 'w-[300px]' : 'w-[84px]'
			)}
			aria-label={t('sidebar.navAria')}
			onMouseEnter={onNavMouseEnter}
			onMouseLeave={onNavMouseLeave}
			onFocusCapture={onNavFocusCapture}
			onBlurCapture={onNavBlurCapture}
		>
			<div
				className={cn(
					'flex items-center border-b border-(--desktop-border-subtle)/90 px-3 py-3.5',
					isSidebarExpanded ? 'justify-between gap-3' : 'justify-center'
				)}
			>
				<div
					className={cn(
						'min-w-0 flex-1 overflow-hidden pr-1 transition-[opacity,max-width] duration-300 ease-out motion-reduce:transition-none',
						sidebarLabelMotion
					)}
				>
					<DesktopAppSectionLabel className="whitespace-nowrap">
						{t('sidebar.sectionsListAria')}
					</DesktopAppSectionLabel>
					<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}>
						{activeModuleTitle}
					</div>
				</div>
				<DesktopAppButton
					type="button"
					size="icon"
					variant={navLayoutActive ? 'accent' : 'ghost'}
					active={navLayoutActive}
					aria-pressed={navLayoutActive}
					className="h-9 w-9 shrink-0"
					onClick={onCycleSidebarNavLayout}
					aria-label={navLayoutCycleAria}
					title={navLayoutCycleAria}
				>
					<NavLayoutIcon
						className="h-4 w-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</DesktopAppButton>
			</div>

			<ul
				className={cn(
					'list-none flex flex-1 flex-col overflow-auto overscroll-contain py-3 transition-[gap,padding] duration-300 ease-out motion-reduce:transition-none',
					isSidebarExpanded ? 'gap-1.5 px-3 pb-4' : 'gap-2 px-2 pb-4'
				)}
				aria-label={t('sidebar.sectionsListAria')}
			>
				{groupedSidebarModules.map(({ group, modules }) => {
					const label = t(`sidebar.groups.${group.id}.title`);
					const description = t(`sidebar.groups.${group.id}.description`);
					const hasActive = modules.some((module) => module.id === activeView);
					if (group.advanced) {
						return (
							<li key={group.id} className="list-none">
								{isSidebarExpanded ? (
									<details
										className="group rounded-sm border border-white/5 bg-[#0d0c10]/35 backdrop-blur-sm"
										open={hasActive}
									>
										<summary
											className={cn(
												'mc-meta-caption cursor-pointer select-none px-3 py-2 text-(--desktop-text-muted)'
											)}
										>
											{label}
										</summary>
										<ul className="m-0 list-none space-y-1.5 p-2 pt-0">
											{modules.map(renderModuleRow)}
										</ul>
									</details>
								) : (
									<ul className="m-0 list-none space-y-1.5 p-0">
										{modules.map(renderModuleRow)}
									</ul>
								)}
							</li>
						);
					}
					return (
						<li key={group.id} className="list-none">
							<div
								className={cn(
									'mc-meta-caption overflow-hidden px-1 pt-2 pb-1 text-(--desktop-text-muted) transition-[opacity,max-height,padding] duration-300 ease-out motion-reduce:transition-none',
									isSidebarExpanded ? 'opacity-100' : 'max-h-0 py-0 opacity-0'
								)}
								title={description}
							>
								{label}
							</div>
							<ul className="m-0 list-none space-y-1.5 p-0">
								{modules.map(renderModuleRow)}
							</ul>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
