/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified admin shell for users, Desktop App Store, UGS, Professional Worlds and platform sections.
 *
 * Invariants:
 * - Access is limited to admin / emperyworld_admin via role-only SPA gate (`ugsAdminAccess`).
 * - Embedded mode must fill the desktop window without changing global page routing.
 * - Section bodies load via module-scope lazy() factories (`shell/AdminSectionLazy.tsx`).
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/shell/adminShellNavTelemetry.ts`
 * - `pages/Admin/shell/AdminSectionLazy.tsx`
 * - `features/ugs/admin-v2/UGSAdminV2Panel.tsx`
 */

import * as React from 'react';
import { Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../services/admin/api';
import { SystemMaintenancePanel } from './system/SystemMaintenancePanel';
import type { NavigationHandler } from '../../types/navigation';
import { log } from '../../utils/logger';
import { isUgsAdminAuthorized } from '../../utils/ugsAdminAccess';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../Desktop/context/DesktopWindowPortalStackContext';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
	getAdminShellSectionMeta,
	type AdminSectionId,
} from './shell/adminShellConfig';
import { resolveAdminSectionLabel } from './shell/adminShellLabels';
import { recordAdminShellSectionSelect } from './shell/adminShellNavTelemetry';
import { reportAdminShellSectionSelect } from './shell/adminShellSectionSelectApi';
import { AdminSectionFrame } from './shell/AdminSectionFrame';
import {
	LazyAdminUsersHubSection,
	LazyAssistantAdminSection,
	LazyContentAdminSection,
	LazyDesktopAiChatAdminSection,
	LazyDesktopAppStoreAdminPage,
	LazyEwaCompanionAdminPanel,
	LazyEwDeskAdminSection,
	LazyFeedbackAdminSection,
	LazyI18nRewriteAdminSection,
	LazyKbsewAdminSection,
	LazyMusicForgeAdminSection,
	LazyProfessionalWorldsAdminSection,
	LazySearchAdminSection,
	LazySiteManagerOpsPanel,
	LazySocialReportsAdminSection,
	LazySurveysAdminSection,
	LazySystemGafInstructionSection,
	LazyUGSAdminV2Panel,
	LazyPlatformOpsAdminSection,
	LazyTopologyAdminSection,
	LazyFactoryAdminSection,
	LazyDocEditorPluginsAdminSection,
	LazyWorkersAdminSection,
} from './shell/AdminSectionLazy';
import { AdminShellContentHeader } from './shell/AdminShellContentHeader';
import { AdminShellGate } from './shell/AdminShellGate';
import {
	ADMIN_SIDEBAR_COLLAPSED_KEY,
	AdminShellSidebar,
} from './shell/AdminShellSidebar';
import {
	loadEmbeddedAdminSection,
	loadLastAdminSection,
	saveEmbeddedAdminSection,
	saveLastAdminSection,
} from './shell/adminShellLastSection';
import {
	readAdminSectionFromUrl,
	syncAdminShellSectionToUrl,
} from './shell/adminShellUrl';
import { migrateLegacyDesktopAiChatAdminShellUrl } from './desktopAiChat/desktopAiChatAdminUrl';
import { migrateLegacyUgsAdminShellUrl } from './shell/ugsAdminShellUrl';
import { useAdminShellNavBadges } from './shell/useAdminShellNavBadges';
import { AdminCommandPalette } from './shell/AdminCommandPalette';
import { dispatchAdminUsersOpen } from './users/adminUsersExternalOpen';
import './shell/eliteewAdminShell.css';
import './ui/tokens.css';

export type { AdminSectionId };

function getInitialSidebarCollapsed(): boolean {
	try {
		const v = localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY);
		if (v != null) {
			return v === 'true';
		}
		return localStorage.getItem('admin_sidebar_collapsed') === 'true';
	} catch {
		return false;
	}
}

interface UnifiedAdminPageProps {
	onNavigate?: NavigationHandler;
	initialSection?: AdminSectionId;
	/** Заполняет окно десктопа вместо полноэкранной страницы */
	embedded?: boolean;
	/** В embedded-режиме: «На рабочий стол» закрывает окно (не меняет hash на весь app) */
	onRequestClose?: () => void;
}

export function UnifiedAdminPage({
	onNavigate,
	initialSection = 'users',
	embedded = false,
	onRequestClose,
}: UnifiedAdminPageProps): React.ReactElement {
	const { user, isAuthenticated, loading } = useAuth();
	const [section, setSection] = useState<AdminSectionId>(initialSection);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(
		getInitialSidebarCollapsed
	);
	const [isMobileOverlayOpen, setMobileOverlayOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(
		() => typeof window !== 'undefined' && window.innerWidth < 768
	);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const urlSyncEnabled = !embedded;

	React.useEffect(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		const handler = () => setIsMobile(mq.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, []);

	const urlSectionAppliedRef = React.useRef(false);
	React.useEffect(() => {
		if (typeof window === 'undefined') {
			setSection(initialSection);
			return;
		}
		if (!urlSectionAppliedRef.current) {
			const fromUrl = readAdminSectionFromUrl();
			if (fromUrl) {
				setSection(fromUrl);
				urlSectionAppliedRef.current = true;
				return;
			}
			const remembered = embedded
				? loadEmbeddedAdminSection()
				: loadLastAdminSection();
			if (remembered) {
				setSection(remembered);
				urlSectionAppliedRef.current = true;
				return;
			}
			urlSectionAppliedRef.current = true;
		}
		setSection(initialSection);
	}, [initialSection, embedded]);

	React.useEffect(() => {
		if (!urlSyncEnabled || typeof window === 'undefined') {
			return;
		}
		migrateLegacyDesktopAiChatAdminShellUrl({ enabled: true });
		migrateLegacyUgsAdminShellUrl({ enabled: true });
	}, [urlSyncEnabled]);

	const contentMainRef = React.useRef<HTMLElement | null>(null);

	const selectSection = useCallback(
		(id: AdminSectionId) => {
			setSection(id);
			const count = recordAdminShellSectionSelect(id, { embedded });
			reportAdminShellSectionSelect(id, { embedded });
			log.debug('UnifiedAdminPage', 'admin_shell_section_select', {
				section: id,
				embedded,
				count,
			});
			if (embedded) {
				saveEmbeddedAdminSection(id);
			} else {
				saveLastAdminSection(id);
			}
			syncAdminShellSectionToUrl(id, { enabled: urlSyncEnabled });
			if (isMobileOverlayOpen) {
				setMobileOverlayOpen(false);
			}
			requestAnimationFrame(() => {
				contentMainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
			});
		},
		[embedded, isMobileOverlayOpen, urlSyncEnabled]
	);

	React.useEffect(() => {
		if (!urlSyncEnabled || typeof window === 'undefined') {
			return;
		}
		try {
			const sp = new URLSearchParams(window.location.search);
			if (!sp.has('section')) {
				syncAdminShellSectionToUrl(section, { enabled: true });
			}
		} catch {
			/* ignore */
		}
	}, [section, urlSyncEnabled]);

	const isAdmin = isUgsAdminAuthorized({ user, isAuthenticated, loading });
	const navBadges = useAdminShellNavBadges(isAdmin);
	const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

	React.useEffect(() => {
		if (!isAdmin || typeof window === 'undefined') return;
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				const tag = document.activeElement?.tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
				e.preventDefault();
				setCommandPaletteOpen(true);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isAdmin]);

	if (loading) {
		return (
			<AdminShellGate
				variant="loading"
				embedded={embedded}
				onNavigate={onNavigate}
				onRequestClose={onRequestClose}
			/>
		);
	}

	if (!isAdmin) {
		return (
			<AdminShellGate
				variant="denied"
				embedded={embedded}
				onNavigate={onNavigate}
				onRequestClose={onRequestClose}
			/>
		);
	}

	const userLabel = user?.email ?? user?.username ?? 'Admin';

	const sidebar = (
		<AdminShellSidebar
			section={section}
			onSectionChange={selectSection}
			collapsed={sidebarCollapsed}
			onCollapsedChange={setSidebarCollapsed}
			isMobile={isMobile}
			onNavigate={onNavigate}
			onRequestClose={onRequestClose}
			userLabel={userLabel}
			navBadges={navBadges}
		/>
	);

	const shellRootClass = embedded
		? 'eliteew-admin-shell eliteew-admin-ui h-full min-h-0 text-white flex relative overflow-hidden eliteew-admin-shell__root'
		: 'eliteew-admin-shell eliteew-admin-ui min-h-screen text-white flex relative eliteew-admin-shell__root';

	return (
		<div className={shellRootClass}>
			<AdminCommandPalette
				open={commandPaletteOpen}
				onClose={() => setCommandPaletteOpen(false)}
				currentSection={section}
				onSectionChange={selectSection}
				onOpenUser={({ search, userId }) => {
					selectSection('users');
					dispatchAdminUsersOpen({ search, userId });
				}}
			/>
			{!isMobile && sidebar}
			{isMobile && isMobileOverlayOpen ? (
				<>
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
						style={{ zIndex: embeddedModalZ.backdrop }}
						aria-hidden
						onClick={() => setMobileOverlayOpen(false)}
					/>
					<div
						className="fixed inset-y-0 left-0 z-40 shrink-0"
						style={{ zIndex: embeddedModalZ.content }}
					>
						<AdminShellSidebar
							section={section}
							onSectionChange={selectSection}
							collapsed={false}
							onCollapsedChange={setSidebarCollapsed}
							isMobile
							isOverlay
							onNavigate={onNavigate}
							onRequestClose={onRequestClose}
							userLabel={userLabel}
							navBadges={navBadges}
						/>
					</div>
				</>
			) : null}

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<AdminShellContentHeader
					section={section}
					isMobile={isMobile}
					onOpenMobileNav={() => setMobileOverlayOpen(true)}
				/>
				<main
					ref={contentMainRef}
					className={`eliteew-admin-shell__content-main flex-1 overflow-auto ${embedded ? 'min-h-0' : ''}`}
				>
					<div
						key={section}
						className="eliteew-admin-shell__section-pane h-full min-h-0"
					>
						{section === 'users' && (
							<div className="h-full min-h-0">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="users" />}
								>
									<LazyAdminUsersHubSection />
								</Suspense>
							</div>
						)}
						{section === 'desktop' && (
							<div className="h-full min-h-0">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="desktop" />}
								>
									<LazyDesktopAppStoreAdminPage embedded />
								</Suspense>
							</div>
						)}
						{section === 'professionalWorlds' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="professionalWorlds" />
									}
								>
									<LazyProfessionalWorldsAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'ugsV2' && <UGSAdminV2PanelEmbed />}
						{section === 'feedback' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="feedback" />}
								>
									<LazyFeedbackAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'socialReports' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="socialReports" />
									}
								>
									<LazySocialReportsAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'surveys' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="surveys" />}
								>
									<LazySurveysAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'assistant' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="assistant" />}
								>
									<LazyAssistantAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'ewdesk' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="ewdesk" />}
								>
									<LazyEwDeskAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'ewaCompanion' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="ewaCompanion" />
									}
								>
									<LazyEwaCompanionAdminPanel />
								</Suspense>
							</div>
						)}
						{section === 'siteStudio' && (
							<div className="h-full min-h-0 overflow-hidden isolate">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="siteStudio" />
									}
								>
									<LazySiteManagerOpsPanel />
								</Suspense>
							</div>
						)}
						{section === 'docEditor' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="docEditor" />}
								>
									<LazyDocEditorPluginsAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'gaf' && (
							<div className="h-full min-h-0 overflow-auto">
								<AdminSectionFrame variant="full">
									<Suspense
										fallback={<AdminShellSectionFallback sectionId="gaf" />}
									>
										<LazySystemGafInstructionSection />
									</Suspense>
								</AdminSectionFrame>
							</div>
						)}
						{section === 'i18nRewrite' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="i18nRewrite" />
									}
								>
									<LazyI18nRewriteAdminSection />
								</Suspense>
							</div>
						)}
						{section === 'search' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="search" />}
								>
									<LazySearchAdminSection
										urlSyncEnabled={urlSyncEnabled}
										onOpenUserInAdmin={(userId) => {
											selectSection('users');
											dispatchAdminUsersOpen({ userId });
										}}
									/>
								</Suspense>
							</div>
						)}
						{section === 'musicForge' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="musicForge" />
									}
								>
									<LazyMusicForgeAdminSection urlSyncEnabled={urlSyncEnabled} />
								</Suspense>
							</div>
						)}
						{section === 'content' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="content" />}
								>
									<LazyContentAdminSection
										urlSyncEnabled={urlSyncEnabled}
										onOpenUserInAdmin={(userId) => {
											selectSection('users');
											dispatchAdminUsersOpen({ userId });
										}}
									/>
								</Suspense>
							</div>
						)}
						{section === 'kbsew' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="kbsew" />}
								>
									<LazyKbsewAdminSection urlSyncEnabled={urlSyncEnabled} />
								</Suspense>
							</div>
						)}
						{section === 'desktopAiChat' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="desktopAiChat" />
									}
								>
									<LazyDesktopAiChatAdminSection
										urlSyncEnabled={urlSyncEnabled}
									/>
								</Suspense>
							</div>
						)}
						{section === 'workers' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="workers" />}
								>
									<LazyWorkersAdminSection urlSyncEnabled={urlSyncEnabled} />
								</Suspense>
							</div>
						)}
						{section === 'platformOps' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={
										<AdminShellSectionFallback sectionId="platformOps" />
									}
								>
									<LazyPlatformOpsAdminSection
										urlSyncEnabled={urlSyncEnabled}
									/>
								</Suspense>
							</div>
						)}
						{section === 'topology' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="topology" />}
								>
									<LazyTopologyAdminSection urlSyncEnabled={urlSyncEnabled} />
								</Suspense>
							</div>
						)}
						{section === 'factory' && (
							<div className="h-full min-h-0 overflow-auto">
								<Suspense
									fallback={<AdminShellSectionFallback sectionId="factory" />}
								>
									<LazyFactoryAdminSection urlSyncEnabled={urlSyncEnabled} />
								</Suspense>
							</div>
						)}
						{section === 'system' && <SystemSection />}
					</div>
				</main>
			</div>
		</div>
	);
}

/** Статус API и БД + сетка карточек раздела «Система» */
function SystemSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const meta = getAdminShellSectionMeta('system');
	const [status, setStatus] = useState<{
		api: 'ok' | 'error' | null;
		db: 'ok' | 'error' | null;
	}>({
		api: null,
		db: null,
	});
	const [statusLoading, setStatusLoading] = useState(false);
	const [actionMessage, setActionMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [overallStatus, setOverallStatus] = useState<
		'loading' | 'healthy' | 'degraded' | 'offline'
	>('loading');
	const [actionInProgress, setActionInProgress] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		setStatusLoading(true);
		setStatus({ api: null, db: null });
		try {
			const { fetchApiDatabaseStatus } = await import(
				'../../services/systemHealth'
			);
			const result = await fetchApiDatabaseStatus();
			setStatus(result);
			if (result.api === 'ok' && result.db === 'ok') {
				setOverallStatus('healthy');
			} else if (result.api === 'ok' || result.db === 'ok') {
				setOverallStatus('degraded');
			} else {
				setOverallStatus('offline');
			}
		} finally {
			setStatusLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchStatus();
		const timer = setInterval(fetchStatus, 120000);
		return () => clearInterval(timer);
	}, [fetchStatus]);

	const runAction = useCallback(
		async (label: string, fn: () => Promise<void>, successMessage: string) => {
			setActionMessage(null);
			try {
				setActionInProgress(label);
				await fn();
				setActionMessage({ type: 'success', text: successMessage });
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				log.error(
					'SystemSection',
					'Admin action failed',
					e instanceof Error ? e : undefined,
					{ label }
				);
				setActionMessage({ type: 'error', text: message });
			} finally {
				setActionInProgress(null);
			}
		},
		[]
	);

	const handleCacheCleanup = useCallback(() => {
		runAction(
			t('adminSystem.cacheCleanupAction'),
			() => adminApi.cleanupCache(),
			t('adminSystem.cacheCleaned')
		);
	}, [runAction, t]);

	return (
		<AdminSectionFrame variant="full">
			<p className="sr-only">{meta.description}</p>

			<div
				className={`eliteew-admin-panel mb-8 flex flex-wrap items-center gap-4 ${DESKTOP_SURFACE.radius}`}
			>
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('adminSystem.statusLabel')}
				</span>
				<div className="flex items-center gap-2">
					<span className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSystem.api')}
					</span>
					{statusLoading ? (
						<span className={DESKTOP_TYPOGRAPHY.small}>…</span>
					) : status.api === 'ok' ? (
						<span
							className="h-2 w-2 rounded-full bg-green-500"
							title={t('adminSystem.statusOk')}
						/>
					) : status.api === 'error' ? (
						<span
							className="h-2 w-2 rounded-full bg-red-500"
							title={t('adminSystem.statusError')}
						/>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<span className={DESKTOP_TYPOGRAPHY.meta}>{t('adminSystem.db')}</span>
					{statusLoading ? (
						<span className={DESKTOP_TYPOGRAPHY.small}>…</span>
					) : status.db === 'ok' ? (
						<span
							className="h-2 w-2 rounded-full bg-green-500"
							title={t('adminSystem.statusOk')}
						/>
					) : status.db === 'error' ? (
						<span
							className="h-2 w-2 rounded-full bg-red-500"
							title={t('adminSystem.statusError')}
						/>
					) : null}
				</div>
				<div className="ml-auto flex items-center gap-3">
					<span className={DESKTOP_TYPOGRAPHY.meta}>
						{overallStatus === 'loading' && t('adminSystem.overallLoading')}
						{overallStatus === 'healthy' && t('adminSystem.overallHealthy')}
						{overallStatus === 'degraded' && t('adminSystem.overallDegraded')}
						{overallStatus === 'offline' && t('adminSystem.overallOffline')}
					</span>
					<button
						type="button"
						onClick={fetchStatus}
						disabled={statusLoading}
						className={`px-2 py-1 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-slate-400 text-xs`}
						title={t('adminSystem.refreshStatusTitle')}
					>
						{t('adminSystem.refreshStatus')}
					</button>
				</div>
			</div>

			{actionMessage ? (
				<div
					className={`mb-6 p-3 ${DESKTOP_SURFACE.radius} ${actionMessage.type === 'success' ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'} ${DESKTOP_TYPOGRAPHY.body}`}
				>
					{actionMessage.text}
				</div>
			) : null}

			{actionInProgress ? (
				<div className={`mb-4 ${DESKTOP_TYPOGRAPHY.meta} text-slate-300`}>
					{t('adminSystem.actionInProgress', { label: actionInProgress })}
				</div>
			) : null}

			<div className="mb-8">
				<SystemMaintenancePanel />
			</div>

			<div className="eliteew-admin-shell__system-links grid gap-4 sm:grid-cols-2">
				<a
					href="https://auth.eliteew.ru/admin/master/console/"
					target="_blank"
					rel="noopener noreferrer"
					className={`flex items-center gap-3 p-4 ${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} bg-white/5 transition-colors hover:bg-white/10 ${DESKTOP_INTERACTIVE.rowHover}`}
				>
					<ShieldCheckIcon className="w-5 h-5 shrink-0 text-amber-400" />
					<div className="flex-1 min-w-0 text-left">
						<div className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('adminSystem.ssoConsoleTitle')}
						</div>
						<div className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminSystem.ssoConsoleDesc')}
						</div>
					</div>
					<ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0 text-slate-500" />
				</a>

				<button
					type="button"
					onClick={handleCacheCleanup}
					className={`flex items-center gap-3 p-4 ${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} bg-white/5 text-left transition-colors hover:bg-white/10 ${DESKTOP_INTERACTIVE.rowInteractive}`}
				>
					<ArrowPathIcon className="w-5 h-5 shrink-0 text-slate-400" />
					<div className="flex-1 min-w-0">
						<div className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('adminSystem.cacheCleanupTitle')}
						</div>
						<div className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminSystem.cacheCleanupDesc')}
						</div>
					</div>
				</button>
			</div>
		</AdminSectionFrame>
	);
}

function AdminShellSectionFallback({
	sectionId,
}: {
	sectionId: AdminSectionId;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const label = resolveAdminSectionLabel(sectionId, t);
	return (
		<AdminSectionFrame>
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-slate-400`}>
				{t('adminShell.loadingSection', { label })}
			</p>
		</AdminSectionFrame>
	);
}

function UGSAdminV2PanelEmbed(): React.ReactElement {
	return (
		<Suspense fallback={<AdminShellSectionFallback sectionId="ugsV2" />}>
			<div className="unified-admin-ugs-wrap h-full min-h-0 overflow-auto">
				<LazyUGSAdminV2Panel />
			</div>
		</Suspense>
	);
}
