import { ADMIN_ROUTES } from '@constants/adminRoutes';
import { useAdminStore } from '@store/slices/adminSlice';
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { AdminNavigate } from './AdminEmbeddedRouter';
import { useIsDesktopEmbeddedAdmin } from './AdminShellModeContext';
import { AdminHeader } from './components/AdminHeader';
import { AdminSidebar } from './components/AdminSidebar';
import {
	ADMIN_EMBEDDED_FOOTER_CLASS,
	ADMIN_EMBEDDED_MAIN_PANEL_CLASS,
	ADMIN_EMBEDDED_ROOT_CLASS,
} from './adminEmbeddedChrome';
import { navItems } from './config/navigation';

export const AdminLayout: React.FC = () => {
	const { t } = useTranslation('siteStudioCms');
	const location = useLocation();
	const { isAuthenticated } = useAdminStore();
	const siteTitle =
		useSiteSettingsStore((state) => state.siteSettings.siteTitle) ||
		t('shell.layout.defaultSiteTitle');
	const isDesktopEmbedded = useIsDesktopEmbeddedAdmin();
	const [sidebarOpen, setSidebarOpen] = useState(isDesktopEmbedded);

	useEffect(() => {
		if (isDesktopEmbedded) {
			setSidebarOpen(true);
		}
	}, [isDesktopEmbedded]);

	if (!isAuthenticated) {
		return <AdminNavigate to={ADMIN_ROUTES.LOGIN} replace />;
	}

	const isActive = (path: string, exact?: boolean) => {
		if (exact) {
			return location.pathname === path;
		}
		return location.pathname.startsWith(path);
	};

	const activeNavItem = navItems.find((item) => isActive(item.to, item.exact));
	const currentPage = activeNavItem
		? t(`shell.nav.${activeNavItem.labelKey}`)
		: t('shell.nav.items.dashboard');

	return (
		<div
			className={
				isDesktopEmbedded
					? ADMIN_EMBEDDED_ROOT_CLASS
					: `bg-linear-to-br from-neutral-50 via-white to-neutral-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex min-h-screen transition-colors duration-300 relative overflow-hidden`
			}
		>
			{/* Decorative background — отключено во встроенном режиме Site Studio (меньше шума и нагрузки) */}
			{!isDesktopEmbedded && (
				<div className="fixed inset-0 overflow-hidden pointer-events-none">
					<div
						className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/20 dark:bg-primary-500/10 rounded-full blur-3xl animate-pulse"
						style={{ animationDuration: '4s' }}
					/>
					<div
						className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-200/20 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse"
						style={{ animationDuration: '6s', animationDelay: '1s' }}
					/>
					<div
						className="absolute -bottom-40 right-1/3 w-80 h-80 bg-amber-200/15 dark:bg-amber-500/5 rounded-full blur-3xl animate-pulse"
						style={{ animationDuration: '5s', animationDelay: '2s' }}
					/>
					<div
						className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-200/10 dark:bg-cyan-500/5 rounded-full blur-3xl animate-pulse"
						style={{ animationDuration: '7s', animationDelay: '0.5s' }}
					/>
				</div>
			)}

			<AdminSidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				embeddedMode={isDesktopEmbedded}
			/>

			<div
				className={`flex-1 flex flex-col relative ${isDesktopEmbedded ? 'min-h-0 h-full' : 'min-h-screen'}`}
			>
				<AdminHeader
					title={currentPage}
					onOpenSidebar={() => setSidebarOpen(true)}
					showSidebarToggle={!isDesktopEmbedded}
				/>

				<main
					className={`flex-1 overflow-auto relative ${isDesktopEmbedded ? 'p-2 sm:p-3' : 'p-4 lg:p-8'}`}
				>
					<div
						className={
							isDesktopEmbedded
								? 'w-full min-w-0'
								: 'mx-auto max-w-7xl animate-in fade-in duration-300'
						}
					>
						<div
							className={
								isDesktopEmbedded
									? `${ADMIN_EMBEDDED_MAIN_PANEL_CLASS} px-3 py-3 sm:px-4 sm:py-4 transition-colors duration-300`
									: `relative border border-neutral-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl transition-colors duration-300 rounded-3xl shadow-[0_18px_45px_rgba(15,23,42,0.15)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8`
							}
						>
							{!isDesktopEmbedded && (
								<div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-linear-to-r from-transparent via-primary-400/70 to-transparent" />
							)}
							<Outlet />
						</div>
					</div>
				</main>

				{/* Footer */}
				<footer
					className={
						isDesktopEmbedded
							? `${ADMIN_EMBEDDED_FOOTER_CLASS} py-1.5 px-2 text-center text-[10px] leading-tight`
							: `text-center text-neutral-400 dark:text-slate-500 border-t border-neutral-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm transition-colors py-4 px-6 text-xs`
					}
				>
					<p className="font-medium flex items-center justify-center gap-1.5 flex-wrap text-neutral-500 dark:text-slate-500">
						<span>
							© {new Date().getFullYear()} {siteTitle}
						</span>
						<span className="text-neutral-300 dark:text-slate-600">·</span>
						<span className="text-primary-600 dark:text-primary-400">
							{t('shell.sidebar.adminPanel')}
						</span>
						<span className="text-neutral-300 dark:text-slate-600">·</span>
						<span className="text-neutral-400 dark:text-slate-500">
							{t('shell.layout.proBadge')}
						</span>
					</p>
				</footer>
			</div>
		</div>
	);
};
