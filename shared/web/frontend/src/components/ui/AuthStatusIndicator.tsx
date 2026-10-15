/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Центр состояния сессии и устройства для desktop shell: профиль, единый баланс,
 * связь с сервером, свежесть токена и быстрые действия восстановления.
 *
 * Invariants:
 * - Повторный login из UI идёт через `beginInteractiveLogin`, чтобы не конкурировать с App/API/socket gates.
 * - Access token используется только для проверки статуса и не выводится в UI/log.
 * - Panel meta (credits label, chips) stays sentence-case — no uppercase shout.
 *
 * Related:
 * - `contexts/AuthContext.tsx`, `utils/authRedirect.ts`, `services/authSession.ts`
 * - `components/ui/sessionPanelChrome.ts`
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAvailableCredits } from './useAvailableCredits';
import { getUserDisplayName } from '../../utils/userDisplayName';
import type { DesktopWindowStyle } from '@/types/profile';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { getDesktopShellPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { SecureAvatar } from '../profile/SecureAvatar';
import { cn } from '@/utils/cn';
import { useSessionDeviceHealth } from './useSessionDeviceHealth';
import {
	SESSION_PANEL_BODY_CLASS,
	SESSION_PANEL_CHIP_CLASS,
	SESSION_PANEL_FOOTER_CLASS,
	SESSION_PANEL_HEADER_CLASS,
	SESSION_PANEL_IDENTITY_CARD_CLASS,
	SESSION_PANEL_META_LABEL_CLASS,
	SESSION_PANEL_METRIC_TILE_CLASS,
	SESSION_PANEL_SHELL_CLASS,
	SESSION_PANEL_STATUS_LINE_CLASS,
} from './sessionPanelChrome';
import {
	ArrowPathIcon,
	ArrowRightStartOnRectangleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	KeyIcon,
	SignalIcon,
	ShieldCheckIcon,
	UserCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

interface AuthStatusIndicatorProps {
	theme?: {
		primary: string;
		secondary: string;
		background: string;
		surface: string;
		text: string;
		accent: string;
		success: string;
		warning: string;
		error: string;
		info: string;
	};
	mode?: 'floating' | 'nav';
	isCollapsed?: boolean;
	/** In nav mode: where the panel opens relative to the button */
	panelPlacement?: 'right' | 'top';
	className?: string;
	/** Открывать панель развернутой по умолчанию (для floating-режима) */
	defaultExpanded?: boolean;
	/** Пресет рамки/стекла как у окон рабочего стола (плавающая панель). */
	shellWindowStyle?: DesktopWindowStyle;
	/** Сообщить родителю, что панель закрыта (крестик / выход). */
	onFloatingPanelClose?: () => void;
	/** Optional realtime state from Desktop socket owner; omitted outside Desktop shell. */
	realtimeConnected?: boolean | null;
	/**
	 * Own the shared session probe poll loop. Default: true for floating panel, false for nav chrome
	 * (tray already retains the loop on desktop).
	 */
	pollingEnabled?: boolean;
	/** Open profile settings window (desktop shell). */
	onOpenProfile?: () => void;
}

const DEFAULT_THEME = {
	primary: '#3b82f6',
	secondary: '#8b5cf6',
	background: '#1e293b',
	surface: '#334155',
	text: '#f1f5f9',
	accent: '#06b6d4',
	success: '#10b981',
	warning: '#f59e0b',
	error: '#ef4444',
	info: '#3b82f6',
};

const AuthStatusIndicator: React.FC<AuthStatusIndicatorProps> = ({
	theme = DEFAULT_THEME,
	mode = 'floating',
	isCollapsed = false,
	panelPlacement: _panelPlacement = 'right',
	className = '',
	defaultExpanded = false,
	shellWindowStyle = 'glass',
	onFloatingPanelClose,
	realtimeConnected = null,
	pollingEnabled: pollingEnabledProp,
	onOpenProfile,
}) => {
	const { t } = useTranslation('desktopUi');
	const { formattedCredits, refetchCredits } = useAvailableCredits();
	const resolvedShellStyle = shellWindowStyle ?? 'glass';
	const pollingEnabled = pollingEnabledProp ?? mode !== 'nav';
	const sessionHealth = useSessionDeviceHealth({
		realtimeConnected,
		pollingEnabled,
	});
	const {
		user,
		isAuthenticated,
		loading,
		profileStatus,
		lastCheck,
		checkCount,
		consecutiveFailures,
		lastError,
		tokenSecondsLeft,
		manualCheckInProgress,
		tokenRefreshInProgress,
	} = sessionHealth;

	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	useEffect(() => {
		if (mode === 'nav' && isCollapsed) {
			setIsExpanded(false);
		}
	}, [mode, isCollapsed]);

	const handleCheckNow = async () => {
		await sessionHealth.checkNow();
		void refetchCredits();
	};

	const handleRefreshToken = async () => {
		await sessionHealth.refreshTokenNow();
		void refetchCredits();
	};

	const handleLogout = async () => {
		setIsExpanded(false);
		onFloatingPanelClose?.();
		await sessionHealth.logout();
	};

	const getStatusColor = () => {
		if (loading || sessionHealth.level === 'checking') return theme.info;
		if (sessionHealth.level === 'healthy') return '#22c55e';
		if (sessionHealth.level === 'warning') return theme.warning;
		if (sessionHealth.level === 'critical') return '#b91c1c';
		return theme.info;
	};

	const getStatusText = () => {
		if (loading) {
			return t('sessionPanel.statusInitializing');
		}
		if (sessionHealth.level === 'checking') {
			return t('sessionPanel.statusChecking');
		}

		switch (sessionHealth.level) {
			case 'healthy':
				return t('sessionPanel.health.levelHealthy');
			case 'warning':
				return t('sessionPanel.health.levelWarning');
			case 'critical':
				return t('sessionPanel.health.levelCritical');
			default:
				return t('sessionPanel.health.levelUnknown');
		}
	};

	const getHealthTitle = () => {
		switch (sessionHealth.reason) {
			case 'healthy':
				return t('sessionPanel.health.goodTitle');
			case 'tokenExpiring':
				return t('sessionPanel.health.tokenExpiringTitle');
			case 'realtimeOffline':
				return t('sessionPanel.health.realtimeOfflineTitle');
			case 'temporaryNetwork':
			case 'staleCheck':
				return t('sessionPanel.health.warningTitle');
			case 'tokenExpired':
			case 'signedOut':
				return t('sessionPanel.health.tokenExpiredTitle');
			case 'serverOffline':
				return t('sessionPanel.health.serverOfflineTitle');
			case 'checking':
			case 'initializing':
				return t('sessionPanel.health.checkingTitle');
			default:
				return t('sessionPanel.health.unknownTitle');
		}
	};

	const getHealthBody = () => {
		switch (sessionHealth.reason) {
			case 'healthy':
				return t('sessionPanel.health.goodBody');
			case 'tokenExpiring':
				return t('sessionPanel.health.tokenExpiringBody');
			case 'realtimeOffline':
				return t('sessionPanel.health.realtimeOfflineBody');
			case 'temporaryNetwork':
				return t('sessionPanel.health.temporaryNetworkBody');
			case 'staleCheck':
				return t('sessionPanel.health.staleCheckBody');
			case 'tokenExpired':
				return t('sessionPanel.health.tokenExpiredBody');
			case 'signedOut':
				return t('sessionPanel.health.signedOutBody');
			case 'serverOffline':
				return t('sessionPanel.health.serverOfflineBody');
			case 'checking':
			case 'initializing':
				return t('sessionPanel.health.checkingBody');
			default:
				return t('sessionPanel.health.unknownBody');
		}
	};

	const getPrimaryAdvice = () => {
		switch (sessionHealth.level) {
			case 'healthy':
				return t('sessionPanel.health.goodAdvice');
			case 'warning':
				return t('sessionPanel.health.warningAdvice');
			case 'critical':
				return t('sessionPanel.health.criticalAdvice');
			default:
				return t('sessionPanel.health.checkingAdvice');
		}
	};

	const formatLastErrorForUi = (msg: string | undefined): string => {
		if (!msg) return '';
		if (msg === 'Session expired or not authenticated') {
			return t('sessionPanel.errors.sessionExpired');
		}
		if (msg === 'Network error') {
			return t('sessionPanel.errors.network');
		}
		const http = /^HTTP (\d+)$/.exec(msg);
		if (http) {
			return t('sessionPanel.errors.http', { status: http[1] });
		}
		return msg;
	};

	const formatTimeAgo = (timestamp: number) => {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);

		if (seconds < 5) {
			return t('sessionPanel.timeJustNow');
		}
		if (seconds < 60) {
			return t('sessionPanel.timeSecondsAgo', { count: seconds });
		}
		if (seconds < 3600) {
			return t('sessionPanel.timeMinutesAgo', {
				count: Math.floor(seconds / 60),
			});
		}
		if (seconds < 86400) {
			return t('sessionPanel.timeHoursAgo', {
				count: Math.floor(seconds / 3600),
			});
		}
		return new Date(timestamp).toLocaleTimeString();
	};

	const formatTokenTime = (seconds: number | null): string => {
		if (seconds === null) return t('sessionPanel.tokenTimeUnknown');
		if (seconds <= 0) return t('sessionPanel.tokenTimeExpired');
		if (seconds < 60) {
			return t('sessionPanel.tokenTimeSeconds', { count: seconds });
		}
		if (seconds < 3600) {
			return t('sessionPanel.tokenTimeMinutes', {
				count: Math.ceil(seconds / 60),
			});
		}
		return t('sessionPanel.tokenTimeHours', {
			count: Math.ceil(seconds / 3600),
		});
	};

	const pulseAnimation = {
		scale: [1, 1.2, 1],
		opacity: [1, 0.8, 1],
		transition: {
			duration: sessionHealth.level === 'healthy' ? 2.8 : 1.6,
			repeat: Infinity,
			ease: 'easeInOut' as const,
		},
	};

	const flashAnimation = {
		scale: [1, 1.28, 1],
		opacity: [1, 0.35, 1],
		transition: {
			duration: 0.62,
			repeat: Infinity,
			ease: 'easeInOut' as const,
		},
	};

	const statusDotAnimation =
		sessionHealth.level === 'critical'
			? flashAnimation
			: sessionHealth.level === 'healthy' || sessionHealth.level === 'warning'
				? pulseAnimation
				: {};

	const showHealthCallout =
		sessionHealth.level !== 'healthy' && sessionHealth.level !== 'checking';

	const panelContent = (
		<div
			className={SESSION_PANEL_SHELL_CLASS}
			data-testid="desktop-session-device-panel"
		>
			<header className={SESSION_PANEL_HEADER_CLASS}>
				<motion.span
					className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
					style={{ backgroundColor: getStatusColor() }}
					animate={statusDotAnimation}
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<h3
						className={cn(
							'truncate font-semibold tracking-tight text-(--desktop-text-primary)',
							DESKTOP_TYPOGRAPHY.shellCopy13
						)}
					>
						{t('sessionPanel.title')}
					</h3>
					<p className={SESSION_PANEL_STATUS_LINE_CLASS}>
						{getStatusText()}
						{showHealthCallout ? ` · ${getHealthTitle()}` : null}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					aria-label={t('sessionPanel.closeAria')}
					className="h-8 w-8 shrink-0 text-(--desktop-text-muted) hover:text-(--desktop-text-primary)"
					onClick={() => {
						setIsExpanded(false);
						onFloatingPanelClose?.();
					}}
				>
					<XMarkIcon className="h-4 w-4" />
				</DesktopAppButton>
			</header>

			<div className={SESSION_PANEL_BODY_CLASS}>
				{isAuthenticated && user ? (
					<div className="mb-3 space-y-2">
						<div className={SESSION_PANEL_IDENTITY_CARD_CLASS}>
							<SecureAvatar
								useProfileApi
								className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.22)]"
								alt={t('sessionPanel.avatarAlt')}
							/>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
									{getUserDisplayName(user)}
								</div>
								<div className={cn('truncate', DESKTOP_TYPOGRAPHY.shellMeta10)}>
									{user.email}
								</div>
							</div>
							<div className="shrink-0 text-right">
								<div className={SESSION_PANEL_META_LABEL_CLASS}>
									{t('sessionPanel.creditsAvailableLabel')}
								</div>
								<div className="truncate text-sm font-semibold tabular-nums text-(--desktop-text-primary)">
									{formattedCredits}
								</div>
							</div>
						</div>
						<div className="flex flex-wrap gap-1.5">
							<span className={SESSION_PANEL_CHIP_CLASS}>
								{t('sessionPanel.roleLabel')}:{' '}
								<span className="font-medium capitalize text-(--desktop-text-primary)">
									{user.role
										? user.role.replace('_', ' ')
										: t('sessionPanel.roleFallback')}
								</span>
							</span>
							<span className={SESSION_PANEL_CHIP_CLASS}>
								{user.is_active ? (
									<span className="font-medium text-emerald-500">
										{t('sessionPanel.accountActive')}
									</span>
								) : (
									<span className="font-medium text-red-500">
										{t('sessionPanel.accountInactive')}
									</span>
								)}
							</span>
						</div>
					</div>
				) : null}

				{showHealthCallout ? (
					<div
						className="mb-3 rounded-xl border p-2.5 text-xs leading-relaxed"
						style={{
							borderColor: `${getStatusColor()}44`,
							backgroundColor: `${getStatusColor()}10`,
						}}
					>
						<p className="text-(--desktop-text-primary)">{getHealthBody()}</p>
						<p className="mt-1.5 text-(--desktop-text-muted)">
							{getPrimaryAdvice()}
						</p>
					</div>
				) : (
					<p className="mb-3 text-xs leading-relaxed text-(--desktop-text-muted)">
						{getHealthBody()}
					</p>
				)}

				<div className="grid grid-cols-2 gap-1.5">
					<div className={SESSION_PANEL_METRIC_TILE_CLASS}>
						<div
							className={cn(
								'mb-0.5 flex items-center gap-1.5',
								SESSION_PANEL_META_LABEL_CLASS
							)}
						>
							<ClockIcon className="h-3 w-3" aria-hidden />
							<span>{t('sessionPanel.lastCheckLabel')}</span>
						</div>
						<div className="text-xs font-medium text-(--desktop-text-primary)">
							{formatTimeAgo(lastCheck)}
						</div>
					</div>
					<div className={SESSION_PANEL_METRIC_TILE_CLASS}>
						<div
							className={cn(
								'mb-0.5 flex items-center gap-1.5',
								SESSION_PANEL_META_LABEL_CLASS
							)}
						>
							<KeyIcon className="h-3 w-3" aria-hidden />
							<span>{t('sessionPanel.tokenTimeLabel')}</span>
						</div>
						<div className="text-xs font-medium text-(--desktop-text-primary)">
							{formatTokenTime(tokenSecondsLeft)}
						</div>
					</div>
					<div className={SESSION_PANEL_METRIC_TILE_CLASS}>
						<div
							className={cn(
								'mb-0.5 flex items-center gap-1.5',
								SESSION_PANEL_META_LABEL_CLASS
							)}
						>
							<SignalIcon className="h-3 w-3" aria-hidden />
							<span>{t('sessionPanel.realtimeLabel')}</span>
						</div>
						<div className="text-xs font-medium text-(--desktop-text-primary)">
							{sessionHealth.realtimeHealthy === true
								? t('sessionPanel.realtimeOnline')
								: sessionHealth.realtimeHealthy === false
									? t('sessionPanel.realtimeOffline')
									: t('sessionPanel.realtimeUnknown')}
						</div>
					</div>
					<div className={SESSION_PANEL_METRIC_TILE_CLASS}>
						<div
							className={cn(
								'mb-0.5 flex items-center gap-1.5',
								SESSION_PANEL_META_LABEL_CLASS
							)}
						>
							<ArrowPathIcon className="h-3 w-3" aria-hidden />
							<span>{t('sessionPanel.healthChecksLabel')}</span>
						</div>
						<div className="text-xs font-medium tabular-nums text-(--desktop-text-primary)">
							{checkCount}
						</div>
					</div>
				</div>

				{profileStatus === 'error' && lastError ? (
					<div className="mt-2 rounded-lg border border-[color-mix(in_srgb,rgb(239_68_68)_42%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_12%,rgb(var(--desktop-bg-primary-rgb)))] p-2.5">
						<div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
							<ExclamationTriangleIcon
								className="mt-0.5 h-3.5 w-3.5 shrink-0"
								aria-hidden
							/>
							<div>
								<div className="mb-0.5 font-semibold">
									{t('sessionPanel.errorDetailsTitle')}
								</div>
								<div className="opacity-90">
									{formatLastErrorForUi(lastError)}
								</div>
							</div>
						</div>
					</div>
				) : null}

				{consecutiveFailures > 1 ? (
					<div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5">
						<div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
							<ExclamationTriangleIcon
								className="mt-0.5 h-3.5 w-3.5 shrink-0"
								aria-hidden
							/>
							<div>
								<div className="mb-0.5 font-semibold">
									{t('sessionPanel.connectionIssuesTitle')}
								</div>
								<div className="opacity-90">
									{t('sessionPanel.connectionIssuesBody', {
										count: consecutiveFailures,
									})}
								</div>
							</div>
						</div>
					</div>
				) : null}
			</div>

			<footer className={SESSION_PANEL_FOOTER_CLASS}>
				<div className="grid grid-cols-2 gap-1.5">
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						className="w-full gap-1.5"
						disabled={manualCheckInProgress || profileStatus === 'checking'}
						onClick={() => {
							void handleCheckNow();
						}}
					>
						{manualCheckInProgress ? (
							<motion.span
								animate={{ rotate: 360 }}
								transition={{
									duration: 1,
									repeat: Infinity,
									ease: 'linear' as const,
								}}
								className="inline-flex"
							>
								<ArrowPathIcon className="h-3.5 w-3.5" />
							</motion.span>
						) : (
							<ArrowPathIcon className="h-3.5 w-3.5" />
						)}
						{t('sessionPanel.checkNow')}
					</DesktopAppButton>

					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="w-full gap-1.5"
						disabled={tokenRefreshInProgress}
						onClick={() => {
							void handleRefreshToken();
						}}
					>
						{tokenRefreshInProgress ? (
							<motion.span
								animate={{ rotate: 360 }}
								transition={{
									duration: 1,
									repeat: Infinity,
									ease: 'linear' as const,
								}}
								className="inline-flex"
							>
								<ArrowPathIcon className="h-3.5 w-3.5" />
							</motion.span>
						) : (
							<KeyIcon className="h-3.5 w-3.5" />
						)}
						{t('sessionPanel.refreshToken')}
					</DesktopAppButton>
				</div>
				{onOpenProfile ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="w-full gap-1.5"
						onClick={() => {
							setIsExpanded(false);
							onFloatingPanelClose?.();
							onOpenProfile();
						}}
					>
						<UserCircleIcon className="h-3.5 w-3.5" />
						{t('sessionPanel.openProfileSettings')}
					</DesktopAppButton>
				) : null}
				<div className="grid grid-cols-2 gap-1.5">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full gap-1.5"
						onClick={sessionHealth.refreshLogin}
					>
						<KeyIcon className="h-3.5 w-3.5" />
						{t('sessionPanel.refreshSession')}
					</DesktopAppButton>

					<DesktopAppButton
						type="button"
						variant="danger"
						size="sm"
						className="w-full gap-1.5"
						onClick={handleLogout}
					>
						<ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" />
						{t('sessionPanel.logout')}
					</DesktopAppButton>
				</div>
			</footer>
		</div>
	);

	const floatingAnchorClass = 'fixed bottom-20 right-3 sm:right-4';

	if (mode === 'nav') {
		return (
			<div
				className={cn(
					'inline-flex items-center gap-2 rounded-2xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--glass-bg-strong)_38%,transparent)] px-2.5 py-1.5 shadow-(--desktop-shadow-soft) backdrop-blur-md',
					className
				)}
			>
				<span
					className="inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.7)]"
					style={{ backgroundColor: getStatusColor() }}
				/>
				<div className="flex items-center gap-1.5">
					<ShieldCheckIcon className="h-3.5 w-3.5 text-(--desktop-text-primary)" />
					{!isCollapsed && (
						<span className="text-[11px] leading-none text-(--desktop-text-primary)">
							{t('sessionPanel.navChipTitle')}
							<span className="ml-1 text-[rgb(var(--desktop-accent-rgb))]">
								{t('sessionPanel.creditsShort', { count: formattedCredits })}
							</span>
						</span>
					)}
				</div>
			</div>
		);
	}

	if (!isExpanded) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className={cn(floatingAnchorClass, className)}
				style={{ zIndex: DESKTOP_Z_INDEX.PANEL }}
				data-taskbar-interactive="true"
			>
				<motion.button
					type="button"
					onClick={() => setIsExpanded(true)}
					className={cn(
						'flex items-center gap-3 px-3 py-2 text-sm transition-all duration-200',
						getDesktopShellPanelClassName(resolvedShellStyle, 'standard'),
						'text-(--desktop-text-primary)'
					)}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
				>
					<motion.div
						className="flex items-center gap-2"
						animate={statusDotAnimation}
					>
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={{ backgroundColor: getStatusColor() }}
						/>
						<ShieldCheckIcon className="h-4 w-4 text-(--desktop-text-secondary)" />
					</motion.div>
					<div className="flex flex-col items-start">
						<span className="text-xs text-(--desktop-text-secondary)">
							{t('sessionPanel.navChipTitle')}
						</span>
						<span className="text-[10px] text-[rgb(var(--desktop-accent-rgb))]">
							{t('sessionPanel.creditsShort', { count: formattedCredits })}
						</span>
					</div>
				</motion.button>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9, y: 20 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.9, y: 20 }}
			className={cn(floatingAnchorClass, className)}
			style={{ zIndex: DESKTOP_Z_INDEX.PANEL }}
			data-taskbar-interactive="true"
		>
			{panelContent}
		</motion.div>
	);
};

export default AuthStatusIndicator;
