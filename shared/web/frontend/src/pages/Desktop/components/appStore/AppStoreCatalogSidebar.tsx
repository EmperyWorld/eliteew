/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store left rail — category navigation and summary.
 *
 * Invariants:
 * - Category nav clicks only; filter/search state remains owned by AppStore catalog state.
 * - Rail captions (summary / shortcuts) stay sentence-case — no chrome uppercase shout.
 *
 * Related:
 * - AppStore.tsx, AppStoreKeyboardHints.tsx
 * - documentation/product/desktop/DESKTOP-APP-STORE.md
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { MouseEvent, ReactElement } from 'react';
import { DesktopAppListRow, DesktopAppSkeleton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { AppStoreKeyboardHints } from '../AppStoreKeyboardHints';
import {
	appStoreMetaCaptionClass,
	appStoreSidebarCategoryCountClass,
} from '../../utils/appStoreCompactCardUi';
import type { StoreCategoryDef } from './appStoreCatalogTypes';
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';

const APP_STORE_SIDEBAR_SKELETON_KEYS = [
	'sk-0',
	'sk-1',
	'sk-2',
	'sk-3',
	'sk-4',
] as const;

export type AppStoreCatalogSidebarProps = {
	t: TFunction<'appStore'>;
	variant: 'modal' | 'page';
	embeddedMobileLayout: boolean;
	asideClassName: string;
	isLoading: boolean;
	appsCount: number;
	filterStrip: string;
	storeCategoryNavClass: string;
	activeCategory: string | 'all';
	onCategoryNavClick: (e: MouseEvent<HTMLButtonElement>) => void;
	visibleStoreCategories: StoreCategoryDef[];
	categoryHintText: (categoryId: string) => string;
	categoryTotals: Map<string, number>;
	sidebarNavRow: string;
	sidebarNavIcon: string;
	contentPanel: string;
	sectionPanelShadow: string;
	installedCount: number;
	availableCount: number;
};

export function AppStoreCatalogSidebar({
	t,
	variant,
	embeddedMobileLayout,
	asideClassName,
	isLoading,
	appsCount,
	filterStrip,
	storeCategoryNavClass,
	activeCategory,
	onCategoryNavClick,
	visibleStoreCategories,
	categoryHintText,
	categoryTotals,
	sidebarNavRow,
	sidebarNavIcon,
	contentPanel,
	sectionPanelShadow,
	installedCount,
	availableCount,
}: AppStoreCatalogSidebarProps): ReactElement {
	return (
		<aside
			data-as-guide="sidebar"
			className={asideClassName}
			aria-label={t('nav.aria')}
		>
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<div
					className={cn(
						'pointer-events-none absolute inset-y-0 left-0 z-1 w-7 bg-linear-to-r from-(--desktop-surface-app) to-transparent',
						!embeddedMobileLayout && 'lg:hidden'
					)}
					aria-hidden
				/>
				<div
					className={cn(
						'pointer-events-none absolute inset-y-0 right-0 z-1 w-7 bg-linear-to-l from-(--desktop-surface-app) to-transparent',
						!embeddedMobileLayout && 'lg:hidden'
					)}
					aria-hidden
				/>
				<nav
					className={storeCategoryNavClass}
					aria-label={t('nav.pickCategory')}
				>
					{isLoading ? (
						<div className="flex w-full flex-col gap-2 lg:w-full">
							{APP_STORE_SIDEBAR_SKELETON_KEYS.map((sk) => (
								<DesktopAppSkeleton
									key={sk}
									className="h-9 w-full shrink-0 rounded-(--desktop-radius)"
								/>
							))}
						</div>
					) : (
						<>
							<DesktopChromeTooltip
								content={t('nav.all')}
								placement="right"
								offsetExtra={4}
							>
								<DesktopAppListRow
									type="button"
									data-store-category="all"
									onClick={onCategoryNavClick}
									active={activeCategory === 'all'}
									className={sidebarNavRow}
								>
									<span
										className={cn(
											'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-(--mc-accent) transition-opacity duration-200',
											embeddedMobileLayout ? 'hidden' : 'hidden lg:block',
											activeCategory === 'all' ? 'opacity-100' : 'opacity-0'
										)}
										aria-hidden
									/>
									<span
										className={cn(
											sidebarNavIcon,
											'text-(--desktop-text-muted)',
											activeCategory === 'all' &&
												'border-(--mc-accent-35) bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
										)}
									>
										<BuildingStorefrontIcon
											width={15}
											height={15}
											aria-hidden
										/>
									</span>
									<span className="min-w-0 flex-1 truncate text-left">
										{t('nav.all')}
									</span>
									<span className={appStoreSidebarCategoryCountClass}>
										{appsCount}
									</span>
								</DesktopAppListRow>
							</DesktopChromeTooltip>
							{visibleStoreCategories.map((c) => {
								const hint = categoryHintText(c.id);
								const navTooltip = hint ? `${c.name} — ${hint}` : c.name;
								return (
									<DesktopChromeTooltip
										key={c.id}
										content={navTooltip}
										placement="right"
										offsetExtra={4}
									>
										<DesktopAppListRow
											type="button"
											data-store-category={c.id}
											onClick={onCategoryNavClick}
											active={activeCategory === c.id}
											className={sidebarNavRow}
										>
											<span
												className={cn(
													'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-(--mc-accent) transition-opacity duration-200',
													embeddedMobileLayout ? 'hidden' : 'hidden lg:block',
													activeCategory === c.id ? 'opacity-100' : 'opacity-0'
												)}
												aria-hidden
											/>
											<span
												className={cn(
													sidebarNavIcon,
													'text-(--desktop-text-muted)',
													activeCategory === c.id &&
														'border-(--mc-accent-35) bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
												)}
											>
												<c.icon
													size={15}
													className="shrink-0 opacity-90"
													aria-hidden
												/>
											</span>
											<span className="min-w-0 flex-1 truncate text-left">
												{c.name}
											</span>
											<span className={appStoreSidebarCategoryCountClass}>
												{categoryTotals.get(c.id) ?? 0}
											</span>
										</DesktopAppListRow>
									</DesktopChromeTooltip>
								);
							})}
						</>
					)}
				</nav>
				{activeCategory !== 'all'
					? (() => {
							const hint = categoryHintText(activeCategory);
							if (!hint) return null;
							return (
								<div className="hidden shrink-0 border-t border-(--desktop-border-subtle)/55 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)] px-4 py-2.5 lg:block">
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'leading-snug text-(--desktop-text-muted)'
										)}
									>
										{hint}
									</p>
								</div>
							);
						})()
					: null}
			</div>
			<div
				className={cn(
					'shrink-0 border-t border-(--desktop-border-subtle)/70 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_94%,transparent)] px-4 py-3 ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.04)]',
					!embeddedMobileLayout && 'lg:hidden'
				)}
			>
				<div
					className={cn(
						'flex justify-center gap-4',
						DESKTOP_TYPOGRAPHY.caption
					)}
				>
					<span>
						{t('summary.installed')}{' '}
						<strong className="tabular-nums font-semibold text-[color-mix(in_srgb,rgb(16_185_129)_58%,var(--desktop-text-primary))]">
							{installedCount}
						</strong>
					</span>
					<span className="text-(--desktop-border-subtle)">·</span>
					<span>
						{t('summary.available')}{' '}
						<strong className="tabular-nums font-semibold text-(--desktop-text-secondary)">
							{availableCount}
						</strong>
					</span>
				</div>
			</div>
			{!embeddedMobileLayout ? (
				<AppStoreKeyboardHints t={t} variant={variant} />
			) : null}
			<div
				className={cn(
					'mt-auto min-h-0',
					embeddedMobileLayout ? 'hidden' : 'hidden lg:block',
					contentPanel,
					sectionPanelShadow
				)}
			>
				<div className="p-4">
					<p className={cn(appStoreMetaCaptionClass, 'mb-3')}>
						{t('nav.summary')}
					</p>
					<div
						className={cn(
							'space-y-2.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/60 p-3',
							DESKTOP_TYPOGRAPHY.meta,
							filterStrip
						)}
					>
						<div className="flex justify-between gap-2 text-(--desktop-text-muted)">
							<span>{t('summary.installed')}</span>
							<span className="tabular-nums font-semibold text-[color-mix(in_srgb,rgb(16_185_129)_58%,var(--desktop-text-primary))]">
								{installedCount}
							</span>
						</div>
						<div className="flex justify-between gap-2 text-(--desktop-text-muted)">
							<span>{t('summary.available')}</span>
							<span className="tabular-nums font-semibold text-(--desktop-text-secondary)">
								{availableCount}
							</span>
						</div>
						<div className="flex justify-between gap-2 border-t border-(--desktop-border-subtle)/70 pt-2.5 text-(--desktop-text-muted)">
							<span>{t('summary.inCatalog')}</span>
							<span className="tabular-nums font-medium text-(--desktop-text-primary)">
								{appsCount}
							</span>
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
