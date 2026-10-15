import { ADMIN_ROUTES } from '@constants/adminRoutes';
import type { ThemeId } from '@constants/themePresets';
import { useAdminTheme, type AdminTheme } from '@hooks/useAdminTheme';
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice';
import { applyThemeVariables } from '@utils/themeUtils';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	AcademicCapIcon,
	Bars3Icon,
	BellIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	ChevronRightIcon,
	ComputerDesktopIcon,
	GlobeAltIcon,
	MoonIcon,
	SunIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from './AdminLink';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import { GlobalSearch } from './GlobalSearch';
import { useIsDesktopEmbeddedAdmin } from '../AdminShellModeContext';
import { ADMIN_EMBEDDED_HEADER_SHELL_CLASS } from '../adminEmbeddedChrome';
import clsx from 'clsx';

interface AdminHeaderProps {
	title: string;
	onOpenSidebar: () => void;
	showSidebarToggle?: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
	title,
	onOpenSidebar,
	showSidebarToggle = true,
}) => {
	const { t } = useTranslation('siteStudioCms');
	const [showNotifications, setShowNotifications] = useState(false);
	const [showThemeMenu, setShowThemeMenu] = useState(false);
	const { notifications, loading, error } = useAdminNotifications();
	const { theme, resolvedTheme, setTheme, initTheme } = useAdminTheme();
	const siteSettings = useSiteSettingsStore((state) => state.siteSettings);
	const settingsLoaded = useSiteSettingsStore((state) => state.settingsLoaded);
	const loadSettings = useSiteSettingsStore((state) => state.loadSettings);
	const notificationsRef = useRef<HTMLDivElement>(null);
	const themeRef = useRef<HTMLDivElement>(null);
	const themeMenuTriggerRef = useRef<HTMLButtonElement>(null);
	const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
	const embedded = useIsDesktopEmbeddedAdmin();

	const closeThemeMenu = useCallback(() => {
		setShowThemeMenu(false);
		queueMicrotask(() => themeMenuTriggerRef.current?.focus());
	}, []);

	const closeNotifications = useCallback(() => {
		setShowNotifications(false);
		queueMicrotask(() => notificationsTriggerRef.current?.focus());
	}, []);

	// Initialize theme on mount
	useEffect(() => {
		initTheme();
	}, [initTheme]);

	// Обновляем тему сайта при изменении настроек, если выбрана опция "Сайт"
	useEffect(() => {
		if (theme === 'site' && siteSettings?.defaultTheme) {
			const siteThemeId = siteSettings.defaultTheme as ThemeId;
			applyThemeVariables(siteThemeId);
		}
	}, [theme, siteSettings?.defaultTheme]);

	// Загружаем настройки при монтировании, если они еще не загружены
	useEffect(() => {
		if (!settingsLoaded) {
			loadSettings().catch(() => undefined);
		}
	}, [loadSettings, settingsLoaded]);

	// Close dropdowns on outside click and return focus to trigger (S15-08)
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				notificationsRef.current &&
				!notificationsRef.current.contains(target) &&
				showNotifications
			) {
				closeNotifications();
			}
			if (
				themeRef.current &&
				!themeRef.current.contains(target) &&
				showThemeMenu
			) {
				closeThemeMenu();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showNotifications, showThemeMenu, closeNotifications, closeThemeMenu]);

	const themeOptions: {
		value: AdminTheme;
		label: string;
		icon: typeof SunIcon;
	}[] = useMemo(
		() => [
			{
				value: 'light',
				label: t('shell.header.themeLight'),
				icon: SunIcon,
			},
			{
				value: 'dark',
				label: t('shell.header.themeDark'),
				icon: MoonIcon,
			},
			{
				value: 'system',
				label: t('shell.header.themeSystem'),
				icon: ComputerDesktopIcon,
			},
			{
				value: 'site',
				label: t('shell.header.themeSite'),
				icon: GlobeAltIcon,
			},
		],
		[t]
	);

	const handleThemeChange = async (newTheme: AdminTheme) => {
		await setTheme(newTheme);
		closeThemeMenu();
	};

	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return t('shell.header.greetingMorning');
		if (hour < 18) return t('shell.header.greetingAfternoon');
		return t('shell.header.greetingEvening');
	};

	const greetingLine = `${getGreeting()} • ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`;

	return (
		<header
			title={embedded ? greetingLine : undefined}
			className={clsx(
				embedded
					? clsx(
							ADMIN_EMBEDDED_HEADER_SHELL_CLASS,
							'px-2 sm:px-3 py-1.5 gap-2 shadow-none'
						)
					: 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-neutral-200/50 dark:border-slate-700/50 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300 px-4 lg:px-6 py-3.5 gap-4 shadow-sm'
			)}
		>
			<div
				className={clsx(
					'flex items-center shrink-0',
					embedded ? 'gap-2' : 'gap-4'
				)}
			>
				{showSidebarToggle && (
					<button
						type="button"
						onClick={onOpenSidebar}
						className={clsx(
							'lg:hidden hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors',
							embedded
								? 'p-1.5 rounded-lg'
								: 'p-2.5 rounded-xl duration-200 hover:scale-105 active:scale-95'
						)}
						aria-label={t('shell.header.openMenu')}
					>
						<Bars3Icon
							width={embedded ? 18 : 20}
							height={embedded ? 18 : 20}
							className="text-neutral-600 dark:text-slate-300"
						/>
					</button>
				)}
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2">
						<h1
							className={clsx(
								'font-semibold text-neutral-900 dark:text-white truncate',
								embedded
									? 'text-sm'
									: 'text-lg whitespace-nowrap bg-linear-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent'
							)}
						>
							{title}
						</h1>
					</div>
					<p
						className={clsx(
							'text-xs text-neutral-500 dark:text-slate-400 items-center gap-1.5 mt-0.5',
							embedded ? 'sr-only' : 'hidden sm:flex'
						)}
					>
						<CalendarIcon
							width={12}
							height={12}
							className="text-primary-500 dark:text-primary-400 shrink-0"
							aria-hidden
						/>
						<span className="font-medium">{getGreeting()}</span>
						<span aria-hidden>•</span>
						<span>
							{new Date().toLocaleDateString(undefined, {
								weekday: 'long',
								day: 'numeric',
								month: 'long',
							})}
						</span>
					</p>
				</div>
			</div>

			<div
				className={clsx(
					'hidden md:block min-w-0',
					embedded ? 'flex-1 max-w-none px-1' : 'flex-1 max-w-lg'
				)}
			>
				<GlobalSearch />
			</div>

			<div
				className={clsx(
					'flex items-center shrink-0',
					embedded ? 'gap-1' : 'gap-2'
				)}
			>
				{/* Theme Toggle */}
				<div className="relative" ref={themeRef}>
					{showThemeMenu ? (
						<button
							ref={themeMenuTriggerRef}
							type="button"
							onClick={() =>
								setShowThemeMenu((open) => {
									if (open) {
										queueMicrotask(() => themeMenuTriggerRef.current?.focus());
									}
									return !open;
								})
							}
							className={clsx(
								'relative transition-colors',
								embedded ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-xl duration-200',
								embedded
									? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
									: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 scale-105 shadow-md'
							)}
							aria-label={t('shell.header.themeToggle')}
							aria-expanded="true"
						>
							{resolvedTheme === 'dark' ? (
								<MoonIcon
									width={embedded ? 18 : 20}
									height={embedded ? 18 : 20}
									className={
										embedded ? '' : 'transition-transform duration-300'
									}
								/>
							) : (
								<SunIcon
									width={embedded ? 18 : 20}
									height={embedded ? 18 : 20}
									className={
										embedded ? '' : 'transition-transform duration-300'
									}
								/>
							)}
						</button>
					) : (
						<button
							ref={themeMenuTriggerRef}
							type="button"
							onClick={() =>
								setShowThemeMenu((open) => {
									if (open) {
										queueMicrotask(() => themeMenuTriggerRef.current?.focus());
									}
									return !open;
								})
							}
							className={clsx(
								'relative transition-colors',
								embedded ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-xl duration-200',
								embedded
									? 'text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-700'
									: 'hover:bg-neutral-100 text-neutral-600 dark:hover:bg-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95'
							)}
							aria-label={t('shell.header.themeToggle')}
							aria-expanded="false"
						>
							{resolvedTheme === 'dark' ? (
								<MoonIcon
									width={embedded ? 18 : 20}
									height={embedded ? 18 : 20}
									className={
										embedded ? '' : 'transition-transform duration-300'
									}
								/>
							) : (
								<SunIcon
									width={embedded ? 18 : 20}
									height={embedded ? 18 : 20}
									className={
										embedded ? '' : 'transition-transform duration-300'
									}
								/>
							)}
						</button>
					)}

					{/* Theme Dropdown */}
					{showThemeMenu && (
						<div
							className={clsx(
								'absolute right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl border border-neutral-200/80 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200',
								embedded ? 'mt-1 w-44 rounded-lg' : 'mt-2 w-48 rounded-xl'
							)}
						>
							<div className={clsx('space-y-0.5', embedded ? 'p-1' : 'p-1.5')}>
								{themeOptions.map((option) => {
									const Icon = option.icon;
									const isActive = theme === option.value;
									return (
										<button
											type="button"
											key={option.value}
											onClick={() => handleThemeChange(option.value)}
											aria-label={t('shell.header.themePickAria', {
												label: option.label,
											})}
											className={clsx(
												'w-full flex items-center gap-2 rounded-lg text-left font-medium transition-colors',
												embedded
													? 'px-2 py-2 text-xs'
													: 'gap-3 px-3 py-2.5 text-sm duration-200',
												isActive
													? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 shadow-sm'
													: 'text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-700',
												!embedded && isActive && 'scale-[1.02]',
												!embedded && !isActive && 'hover:scale-[1.01]'
											)}
										>
											<Icon
												width={embedded ? 14 : 16}
												height={embedded ? 14 : 16}
												className={
													isActive
														? 'text-primary-600 dark:text-primary-400'
														: ''
												}
											/>
											<span className="flex-1 text-left">{option.label}</span>
											{isActive && (
												<span
													className={clsx(
														'rounded-full bg-primary-500 dark:bg-primary-400 shadow-sm shadow-primary-500/50',
														embedded ? 'h-1.5 w-1.5' : 'w-2 h-2 animate-pulse'
													)}
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Notifications */}
				<div className="relative" ref={notificationsRef}>
					{showNotifications ? (
						<button
							ref={notificationsTriggerRef}
							type="button"
							className={clsx(
								'relative transition-colors',
								embedded ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-xl duration-200',
								embedded
									? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
									: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 scale-105 shadow-md'
							)}
							aria-label={
								notifications.length > 0
									? t('shell.header.notificationsWithCount', {
											count: notifications.length,
										})
									: t('shell.header.notifications')
							}
							aria-expanded="true"
							onClick={() =>
								setShowNotifications((open) => {
									if (open) {
										queueMicrotask(() =>
											notificationsTriggerRef.current?.focus()
										);
									}
									return !open;
								})
							}
						>
							<BellIcon
								width={embedded ? 18 : 20}
								height={embedded ? 18 : 20}
								className={!embedded ? 'animate-pulse' : ''}
							/>
							{notifications.length > 0 && (
								<span
									className={clsx(
										'absolute bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-lg shadow-red-500/50',
										embedded
											? 'top-1 right-1 h-2 w-2'
											: 'top-1.5 right-1.5 w-2.5 h-2.5 animate-pulse'
									)}
									aria-hidden
								/>
							)}
						</button>
					) : (
						<button
							ref={notificationsTriggerRef}
							type="button"
							className={clsx(
								'relative transition-colors',
								embedded ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-xl duration-200',
								embedded
									? 'text-neutral-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-700'
									: 'hover:bg-neutral-100 text-neutral-600 dark:hover:bg-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95'
							)}
							aria-label={
								notifications.length > 0
									? t('shell.header.notificationsWithCount', {
											count: notifications.length,
										})
									: t('shell.header.notifications')
							}
							aria-expanded="false"
							onClick={() =>
								setShowNotifications((open) => {
									if (open) {
										queueMicrotask(() =>
											notificationsTriggerRef.current?.focus()
										);
									}
									return !open;
								})
							}
						>
							<BellIcon
								width={embedded ? 18 : 20}
								height={embedded ? 18 : 20}
							/>
							{notifications.length > 0 && (
								<span
									className={clsx(
										'absolute bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-lg shadow-red-500/50',
										embedded
											? 'top-1 right-1 h-2 w-2'
											: 'top-1.5 right-1.5 w-2.5 h-2.5 animate-pulse'
									)}
									aria-hidden
								/>
							)}
						</button>
					)}

					{/* Notifications Dropdown */}
					{showNotifications && (
						<div
							className={clsx(
								'absolute right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl border border-neutral-200/80 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200',
								embedded
									? 'mt-1 w-[min(100vw-2rem,18rem)] rounded-lg'
									: 'mt-2 w-80 rounded-2xl'
							)}
						>
							<div
								className={clsx(
									'border-b border-neutral-100 dark:border-slate-700 bg-linear-to-r from-primary-50/60 dark:from-primary-900/30 to-transparent',
									embedded ? 'p-2' : 'p-4'
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<h3
										className={clsx(
											'font-semibold text-neutral-900 dark:text-white flex items-center gap-2 min-w-0',
											embedded ? 'text-xs' : 'text-base'
										)}
									>
										<div
											className={clsx(
												'rounded-lg bg-primary-100 dark:bg-primary-900/40 shrink-0',
												embedded ? 'p-1' : 'p-1.5'
											)}
										>
											<BellIcon
												width={embedded ? 12 : 14}
												height={embedded ? 12 : 14}
												className="text-primary-600 dark:text-primary-400"
											/>
										</div>
										{t('shell.header.notificationsHeading')}
									</h3>
									<button
										type="button"
										onClick={() => closeNotifications()}
										className={clsx(
											'hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0',
											embedded
												? 'p-1'
												: 'p-1.5 duration-200 hover:scale-110 active:scale-95'
										)}
										aria-label={t('shell.header.notificationsClose')}
									>
										<XMarkIcon
											width={embedded ? 12 : 14}
											height={embedded ? 12 : 14}
											className="text-neutral-400"
										/>
									</button>
								</div>
								{notifications.length > 0 && (
									<p
										className={clsx(
											'text-neutral-500 dark:text-slate-400 font-medium',
											embedded ? 'text-[10px] mt-1' : 'text-xs mt-2'
										)}
									>
										{t('shell.header.notificationsNew', {
											count: notifications.length,
										})}
									</p>
								)}
							</div>
							<div
								className={
									embedded
										? 'max-h-56 overflow-y-auto'
										: 'max-h-72 overflow-y-auto'
								}
							>
								{loading && (
									<div
										className={clsx('text-center', embedded ? 'p-3' : 'p-6')}
									>
										<div className="w-6 h-6 border-2 border-primary-200 dark:border-primary-800 border-t-primary-500 rounded-full animate-spin mx-auto" />
										<p
											className={clsx(
												'text-neutral-500 dark:text-slate-400 mt-2',
												embedded ? 'text-xs' : 'text-sm'
											)}
										>
											{t('shell.header.notificationsLoading')}
										</p>
									</div>
								)}
								{!loading && error && (
									<p className="p-4 text-sm text-red-600 text-center bg-red-50 dark:bg-red-900/20">
										{error}
									</p>
								)}
								{!loading &&
									!error &&
									(notifications.length === 0 ? (
										<div
											className={clsx('text-center', embedded ? 'p-3' : 'p-6')}
										>
											<BellIcon
												width={embedded ? 24 : 32}
												height={embedded ? 24 : 32}
												className="mx-auto text-neutral-200 dark:text-slate-600 mb-2"
											/>
											<p
												className={clsx(
													'text-neutral-500 dark:text-slate-400',
													embedded ? 'text-xs' : 'text-sm'
												)}
											>
												{t('shell.header.notificationsEmpty')}
											</p>
										</div>
									) : (
										notifications.map((n) => (
											<Link
												key={n.id}
												to={ADMIN_ROUTES.BOOKINGS}
												className={clsx(
													'flex items-start border-b border-neutral-50 dark:border-slate-700/50 last:border-0 transition-colors group',
													embedded
														? 'gap-2 p-2 hover:bg-neutral-50 dark:hover:bg-slate-700/50'
														: 'gap-3 p-3.5 hover:bg-neutral-50 dark:hover:bg-slate-700/50 duration-200 hover:scale-[1.01]'
												)}
												onClick={() => closeNotifications()}
											>
												<div
													className={clsx(
														'rounded-lg shrink-0',
														embedded
															? 'p-1.5'
															: 'p-2 duration-200 group-hover:scale-110',
														n.type === 'consultation'
															? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50'
															: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
													)}
												>
													{n.type === 'consultation' ? (
														<ChatBubbleLeftRightIcon
															width={embedded ? 12 : 14}
															height={embedded ? 12 : 14}
														/>
													) : (
														<AcademicCapIcon
															width={embedded ? 12 : 14}
															height={embedded ? 12 : 14}
														/>
													)}
												</div>
												<div className="flex-1 min-w-0">
													<p
														className={clsx(
															'font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors',
															embedded ? 'text-xs' : 'text-sm'
														)}
													>
														{n.title}
													</p>
													<p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
														{n.time}
													</p>
												</div>
												<ChevronRightIcon
													width={14}
													height={14}
													className={clsx(
														'text-neutral-300 dark:text-slate-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 shrink-0 mt-1 transition-[color,transform] duration-200 motion-reduce:transition-none',
														!embedded && 'group-hover:translate-x-0.5'
													)}
												/>
											</Link>
										))
									))}
							</div>
							<Link
								to={ADMIN_ROUTES.BOOKINGS}
								className={clsx(
									'flex items-center justify-center gap-1 font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-t border-neutral-100 dark:border-slate-700 transition-colors',
									embedded ? 'p-2 text-xs' : 'p-3 text-sm'
								)}
								onClick={() => closeNotifications()}
							>
								{t('shell.header.allBookings')}
								<ChevronRightIcon width={14} height={14} />
							</Link>
						</div>
					)}
				</div>

				{/* User profile */}
				<div
					className={clsx(
						'hidden sm:flex items-center ml-1 border-l border-neutral-200 dark:border-slate-700',
						embedded ? 'gap-1.5 pl-2' : 'gap-3 pl-3'
					)}
				>
					<div
						title={embedded ? t('shell.header.avatarTitleEmbedded') : undefined}
						className={clsx(
							'rounded-xl bg-linear-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center text-white font-semibold shadow-lg shadow-primary-500/30 cursor-pointer',
							embedded
								? 'h-7 w-7 text-xs shadow-md'
								: 'w-9 h-9 text-sm hover:shadow-primary-500/50 transition-[box-shadow,transform] duration-300 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-110'
						)}
					>
						A
					</div>
					{!embedded && (
						<div className="hidden lg:block">
							<p className="text-sm font-semibold text-neutral-900 dark:text-white">
								{t('shell.header.displayNameShort')}
							</p>
							<p className="text-xs text-neutral-500 dark:text-slate-400 font-medium">
								{t('shell.header.roleAdministrator')}
							</p>
						</div>
					)}
				</div>
			</div>
		</header>
	);
};
