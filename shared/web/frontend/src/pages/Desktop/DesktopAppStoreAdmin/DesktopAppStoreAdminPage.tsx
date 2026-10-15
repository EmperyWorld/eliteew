/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin shell: tab nav and active tab mount.
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/utils/cn';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { syncLocationHashToPage } from '../../../utils/pageRouting';
import { DesktopAppButton } from '../components/DesktopAppChrome';
import { DesktopChromeTooltip } from '../components/DesktopChromeTooltip';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ArrowLeftIcon,
	CubeIcon,
	KeyIcon,
	Squares2X2Icon,
	WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { AccessGroupsTab } from './AccessGroupsTab';
import { CatalogTab } from './CatalogTab';
import { MaintenanceAdminTab } from './MaintenanceAdminTab';
import { StorefrontAdminTab } from './StorefrontAdminTab';
import type {
	DesktopAppStoreAdminPageProps,
	DesktopAppStoreAdminTabId,
} from './types';

export function DesktopAppStoreAdminPage(
	props: DesktopAppStoreAdminPageProps
): React.ReactElement {
	const { t } = useTranslation('appStore');
	const { embedded = false, initialTab = 'catalog' } = props;
	const [activeTab, setActiveTab] =
		useState<DesktopAppStoreAdminTabId>(initialTab);
	const _queryClient = useQueryClient();

	const goBack = useCallback(() => {
		syncLocationHashToPage('desktop');
	}, []);

	return (
		<div
			className={
				embedded
					? 'flex min-h-screen flex-col bg-(--desktop-surface-app) text-(--desktop-text-primary)'
					: 'flex min-h-screen flex-col bg-(--desktop-surface-app) bg-linear-to-b from-(--desktop-surface-soft) via-(--desktop-surface-app) to-(--desktop-surface-soft) text-(--desktop-text-primary)'
			}
		>
			{!embedded && (
				<header className="relative shrink-0 overflow-hidden border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-4 backdrop-blur-xl">
					<div
						className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[rgb(var(--desktop-accent-rgb))/0.12] blur-3xl"
						aria-hidden
					/>
					<div
						className="pointer-events-none absolute -bottom-20 left-1/4 h-36 w-48 rounded-full bg-[rgb(var(--desktop-accent-rgb))/0.08] blur-3xl"
						aria-hidden
					/>
					<div className="relative flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<DesktopChromeTooltip
								content={t('admin.shell.backAria')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									onClick={goBack}
									aria-label={t('admin.shell.backAria')}
									className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 shadow-sm shadow-black/15 hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)"
								>
									<ArrowLeftIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								</DesktopAppButton>
							</DesktopChromeTooltip>
							<div className="flex items-center gap-2.5">
								<div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--desktop-accent-rgb))/0.35] bg-[rgb(var(--desktop-accent-rgb))/0.18] shadow-md shadow-black/20 [&_svg]:stroke-[1.35]">
									<CubeIcon
										className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
										aria-hidden
									/>
								</div>
								<div>
									<h1
										className={cn(
											DESKTOP_TYPOGRAPHY.title,
											'text-xl font-semibold'
										)}
									>
										{t('admin.shell.pageTitle')}
									</h1>
									<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{t('admin.shell.pageSubtitle')}
									</p>
								</div>
							</div>
						</div>
					</div>
				</header>
			)}

			<nav
				className="flex shrink-0 flex-wrap gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-2.5 backdrop-blur-sm md:px-5"
				aria-label={t('admin.shell.navAria')}
			>
				{[
					{
						id: 'catalog' as DesktopAppStoreAdminTabId,
						icon: CubeIcon,
					},
					{
						id: 'groups' as DesktopAppStoreAdminTabId,
						icon: KeyIcon,
					},
					{
						id: 'storefront' as DesktopAppStoreAdminTabId,
						icon: Squares2X2Icon,
					},
					{
						id: 'maintenance' as DesktopAppStoreAdminTabId,
						icon: WrenchScrewdriverIcon,
					},
				].map(({ id, icon: Icon }) => (
					<DesktopAppButton
						key={id}
						type="button"
						variant={activeTab === id ? 'accent' : 'ghost'}
						size="md"
						onClick={() => setActiveTab(id)}
						className="gap-2"
						active={activeTab === id}
						aria-pressed={activeTab === id}
					>
						<Icon className="h-4 w-4" aria-hidden />
						{t(`admin.shell.tabs.${id}`)}
					</DesktopAppButton>
				))}
			</nav>

			<main
				className="flex-1 overflow-auto px-5 py-5 md:px-6 md:py-6"
				aria-label={t('admin.shell.mainAria')}
			>
				{activeTab === 'catalog' && <CatalogTab />}
				{activeTab === 'groups' && <AccessGroupsTab />}
				{activeTab === 'storefront' && <StorefrontAdminTab />}
				{activeTab === 'maintenance' && <MaintenanceAdminTab />}
			</main>
		</div>
	);
}
