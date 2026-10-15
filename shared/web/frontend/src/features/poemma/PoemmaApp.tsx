/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Poemma desktop runtime shell with role-aware routing, workspace bootstrap, and sync-status UX.
 *
 * Invariants:
 * - UI language is Russian-only and avoids marketing dashboard jargon.
 * - localStorage is scoped to Empery user.id (tenant isolation).
 * - Team roles do not see profit, channels or full owner-only sections.
 * - Server-sync fallback/degraded states must be explicit in UI (no silent failures).
 * - DEV role switcher only for workspace owner or platform admin (server ACL mirror).
 * - This app is embedded in EliteEW Desktop and does not create a separate Vite app.
 * - Wave 26+: routing/session helpers and route body live in sibling modules (<800 LOC each).
 *
 * Related:
 * - poemma/AGENTS.md
 * - poemmaAppRouting.ts, PoemmaRouteBody.tsx
 * - documentation/product/desktop/DESKTOP-API-AND-APPS.md (§ Poemma)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopProductStatePanel,
	DesktopProductStatusBanner,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { resolvePoemmaHomeRoute } from './onboarding/PoemmaOnboarding';
import {
	poemmaUserSyncBannerCopy,
	POEMMA_USER_LOAD_COPY,
} from './poemmaUserChromeCopy';
import type { PoemmaPeriod, PoemmaUserRole } from './poemmaDomain';
import {
	getPoemmaRepository,
	refreshPoemmaRoleFromServer,
	readPoemmaSyncStatus,
	subscribePoemmaSyncStatus,
	type PoemmaSyncStatus,
	updatePoemmaRoleOnServer,
} from './poemmaRepository';
import { canChangePoemmaRoleOnServer } from './poemmaRoleChangeAcl';
import { PoemmaDevRoleSelect, PoemmaTopBar } from './ui';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { useTranslation } from 'react-i18next';
import {
	POEMMA_GUIDE_AUDIO_LS_KEY,
	POEMMA_GUIDE_ROOT_ID,
	POEMMA_GUIDE_STEP_DEFS,
	POEMMA_GUIDE_TOUR_FOLDER,
} from './poemmaGuideConstants';
import {
	DEV_POEMMA_ROLE_PRESETS,
	OWNER_MORE_NAV,
	OWNER_NAV,
	TEAM_MORE_NAV,
	TEAM_NAV,
	type PoemmaRoute,
	type PoemmaSession,
	findPoemmaPage,
	isPoemmaNavPathActive,
	poemmaRoleLabel,
	resolvePoemmaErrorMessage,
	resolvePoemmaRoute,
	resolvePoemmaSession,
	routeAllowedForSession,
} from './poemmaAppRouting';
import { PoemmaRouteBody, PoemmaUnauthenticated } from './PoemmaRouteBody';

export function PoemmaApp() {
	const { user, isAuthenticated } = useAuth();
	const ownerUserId = user?.id?.trim() ?? '';
	const poemmaRepository = useMemo(
		() => (ownerUserId ? getPoemmaRepository(ownerUserId) : null),
		[ownerUserId]
	);

	const [session, setSession] = useState<PoemmaSession>(
		user ? resolvePoemmaSession(user) : DEV_POEMMA_ROLE_PRESETS[0]
	);
	const [currentPath, setCurrentPath] = useState<string>('/');
	const [period, setPeriod] = useState<PoemmaPeriod | null>(null);
	const [hasWorkspace, setHasWorkspace] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [syncStatus, setSyncStatus] = useState<PoemmaSyncStatus>(() =>
		readPoemmaSyncStatus(ownerUserId)
	);
	const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(
		null
	);
	const [workspaceReloadKey, setWorkspaceReloadKey] = useState(0);

	const ownerDisplayName = session.displayName;

	useEffect(() => {
		if (!user) {
			setSession(DEV_POEMMA_ROLE_PRESETS[0]);
			return;
		}
		setSession(resolvePoemmaSession(user));
	}, [user]);

	useEffect(() => {
		if (!ownerUserId) {
			setSyncStatus(readPoemmaSyncStatus('legacy-unscoped'));
			return;
		}
		setSyncStatus(readPoemmaSyncStatus(ownerUserId));
		return subscribePoemmaSyncStatus(ownerUserId, setSyncStatus);
	}, [ownerUserId]);

	useEffect(() => {
		if (!ownerUserId) {
			return;
		}
		let cancelled = false;
		void refreshPoemmaRoleFromServer(ownerUserId).then((serverRole) => {
			if (cancelled || !serverRole) {
				return;
			}
			setSession((previous) =>
				previous.role === serverRole
					? previous
					: {
							...previous,
							role: serverRole,
							roleLabel: poemmaRoleLabel(serverRole),
						}
			);
		});
		return () => {
			cancelled = true;
		};
	}, [ownerUserId]);

	async function initializeWorkspace(): Promise<void> {
		if (!poemmaRepository || !ownerDisplayName) {
			return;
		}
		const workspace = await poemmaRepository.initializeWorkspace({
			displayName: 'Мой бизнес',
			ownerDisplayName,
		});
		setHasWorkspace(true);
		setPeriod(workspace.period);
		setCurrentPath('/');
	}

	function handleRoleChange(role: PoemmaUserRole): void {
		if (
			!canChangePoemmaRoleOnServer({
				poemmaRole: session.role,
				platformRole: user?.role,
			})
		) {
			return;
		}
		void updatePoemmaRoleOnServer(ownerUserId, role).then((serverRole) => {
			if (!serverRole) {
				return;
			}
			const nextSession =
				DEV_POEMMA_ROLE_PRESETS.find((item) => item.role === serverRole) ??
				({
					role: serverRole,
					displayName: session.displayName,
					roleLabel: poemmaRoleLabel(serverRole),
				} satisfies PoemmaSession);
			setSession((previous) => ({
				...previous,
				role: nextSession.role,
				roleLabel: nextSession.roleLabel,
				displayName: nextSession.displayName || previous.displayName,
			}));
			const { template } = resolvePoemmaRoute(currentPath);
			const page = findPoemmaPage(template);
			if (!routeAllowedForSession(page, { ...session, role: serverRole })) {
				setCurrentPath('/');
			}
		});
	}

	function selectRoute(path: string): void {
		setCurrentPath(path);
	}

	function retryWorkspaceLoad(): void {
		setWorkspaceLoadError(null);
		setWorkspaceReloadKey((previous) => previous + 1);
	}

	function retryServerSync(): void {
		setWorkspaceLoadError(null);
		void refreshPoemmaRoleFromServer(ownerUserId);
		setWorkspaceReloadKey((previous) => previous + 1);
	}

	function handlePeriodClosed(): void {
		void (async () => {
			if (!poemmaRepository) {
				return;
			}
			const currentPeriod = await poemmaRepository.getCurrentPeriod();
			setPeriod(currentPeriod);
			setCurrentPath('/');
		})();
	}

	async function applyPoemmaHomeRoute(): Promise<void> {
		if (!poemmaRepository || !hasWorkspace) {
			return;
		}
		const route = await resolvePoemmaHomeRoute(poemmaRepository);
		setCurrentPath((prev) => {
			if (route === '/onboarding' && prev !== '/onboarding') {
				return '/onboarding';
			}
			if (route === '/' && prev === '/onboarding') {
				return '/';
			}
			return prev;
		});
	}

	function handleOnboardingComplete(): void {
		void (async () => {
			if (!poemmaRepository) {
				return;
			}
			const currentPeriod = await poemmaRepository.getCurrentPeriod();
			setPeriod(currentPeriod);
			await applyPoemmaHomeRoute();
		})();
	}

	useEffect(() => {
		if (!poemmaRepository) {
			setIsLoaded(true);
			setHasWorkspace(false);
			setPeriod(null);
			setWorkspaceLoadError(null);
			return;
		}

		const repository = poemmaRepository;
		let isMounted = true;
		const loadAttempt = workspaceReloadKey;
		if (loadAttempt > 0) {
			setWorkspaceLoadError(null);
		}

		async function loadWorkspace(): Promise<void> {
			try {
				setWorkspaceLoadError(null);
				const [org, currentPeriod] = await Promise.all([
					repository.getOrg(),
					repository.getCurrentPeriod(),
				]);
				if (!isMounted) {
					return;
				}
				const workspaceReady = !!org;
				setHasWorkspace(workspaceReady);
				setPeriod(currentPeriod);
				setIsLoaded(true);

				if (workspaceReady) {
					const route = await resolvePoemmaHomeRoute(repository);
					if (!isMounted) {
						return;
					}
					setCurrentPath((prev) => {
						if (route === '/onboarding' && prev !== '/onboarding') {
							return '/onboarding';
						}
						if (route === '/' && prev === '/onboarding') {
							return '/';
						}
						return prev;
					});
				}
			} catch (error) {
				if (!isMounted) {
					return;
				}
				setWorkspaceLoadError(resolvePoemmaErrorMessage(error));
				setHasWorkspace(false);
				setPeriod(null);
				setIsLoaded(true);
			}
		}

		setIsLoaded(false);
		void loadWorkspace();

		return () => {
			isMounted = false;
		};
	}, [poemmaRepository, workspaceReloadKey]);

	const { t: tg } = useTranslation('desktopUi', { keyPrefix: 'poemma' });
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(tg, 'guide'), [tg]);
	const guideSteps = useBuiltGuideSteps(
		tg,
		'guide.steps',
		POEMMA_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const prepareGuideStep = useCallback(
		(stepId: string) => {
			if (stepId === 'decision-guide') {
				setCurrentPath('/guide');
				return;
			}
			if (stepId === 'workspace' && currentPath !== '/') {
				setCurrentPath('/');
			}
		},
		[currentPath]
	);

	if (!isAuthenticated || !ownerUserId) {
		return (
			<DesktopAppContentWrapper
				appComponent="PoemmaApp"
				mode="passthrough"
				className="h-full min-h-0 overflow-hidden"
			>
				<PoemmaUnauthenticated />
			</DesktopAppContentWrapper>
		);
	}

	const resolvedRoute = resolvePoemmaRoute(currentPath);
	const currentPage = hasWorkspace
		? findPoemmaPage(resolvedRoute.template)
		: findPoemmaPage('/onboarding');
	const navPaths = session.role === 'owner' ? OWNER_NAV : TEAM_NAV;
	const morePaths = session.role === 'owner' ? OWNER_MORE_NAV : TEAM_MORE_NAV;
	const topBarNavItems = [...navPaths, ...morePaths].map((path) => {
		const page = findPoemmaPage(path);
		return { path, shortTitle: page.shortTitle };
	});
	const showDevRoleSwitcher =
		import.meta.env.DEV &&
		canChangePoemmaRoleOnServer({
			poemmaRole: session.role,
			platformRole: user?.role,
		});
	const showSyncFallbackBanner =
		syncStatus.stage === 'fallback-local' || syncStatus.stage === 'degraded';
	const syncBannerCopy = poemmaUserSyncBannerCopy(syncStatus);

	return (
		<DesktopAppContentWrapper
			appComponent="PoemmaApp"
			id={POEMMA_GUIDE_ROOT_ID}
			mode="passthrough"
			className="h-full min-h-0 overflow-hidden"
		>
			<DesktopProductWorkspace
				toolbar={
					<div data-poemma-guide="top-bar">
						<PoemmaTopBar
							session={session}
							syncStatus={syncStatus}
							period={period}
							navItems={topBarNavItems}
							isNavActive={(path) =>
								isPoemmaNavPathActive(
									path as PoemmaRoute,
									currentPath,
									resolvedRoute.template
								)
							}
							onSelect={selectRoute}
							actions={
								showDevRoleSwitcher ? (
									<PoemmaDevRoleSelect
										presets={DEV_POEMMA_ROLE_PRESETS}
										value={session.role}
										onChange={handleRoleChange}
									/>
								) : null
							}
						/>
					</div>
				}
			>
				{showSyncFallbackBanner ? (
					<div className="px-4 pt-4">
						<DesktopProductStatusBanner
							tone={syncBannerCopy.tone}
							title={syncBannerCopy.title}
							description={syncBannerCopy.description}
							actions={
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={retryServerSync}
								>
									{syncBannerCopy.actionLabel}
								</DesktopAppButton>
							}
						/>
					</div>
				) : null}
				{isLoaded ? (
					<div data-poemma-guide="workspace">
						{workspaceLoadError ? (
							<div className="p-4">
								<DesktopProductStatePanel
									state="error"
									title={POEMMA_USER_LOAD_COPY.errorTitle}
									description={workspaceLoadError}
									actions={
										<DesktopAppButton
											type="button"
											variant="accent"
											onClick={retryWorkspaceLoad}
										>
											{POEMMA_USER_LOAD_COPY.retryLoad}
										</DesktopAppButton>
									}
								/>
							</div>
						) : (
							<PoemmaRouteBody
								page={currentPage}
								resolved={resolvedRoute}
								session={session}
								ownerUserId={ownerUserId}
								hasWorkspace={hasWorkspace}
								onInitialize={initializeWorkspace}
								onNavigate={selectRoute}
								onOnboardingComplete={handleOnboardingComplete}
								onPeriodClosed={handlePeriodClosed}
							/>
						)}
					</div>
				) : (
					<div className="p-4">
						<DesktopProductStatePanel
							state="loading"
							title={POEMMA_USER_LOAD_COPY.loadingTitle}
							description={POEMMA_USER_LOAD_COPY.loadingDescription}
						/>
					</div>
				)}
			</DesktopProductWorkspace>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={POEMMA_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={POEMMA_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={POEMMA_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				onPrepareStep={prepareGuideStep}
				spotlightLayoutKey={`${guideOpen}-${currentPath}`}
				dialogTitleId="poemma-guide-title"
			/>
		</DesktopAppContentWrapper>
	);
}

export default PoemmaApp;
