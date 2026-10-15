/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Navigation model for Professional Worlds desktop: nav items, module guards, background stream peek, and nav mode.
 *
 * Invariants:
 * - Disabled modules stay visible with lock hints; guards redirect away from unavailable views.
 * - Embedded mobile uses a reduced nav contract from `mobileEmbeddedViews`.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - professionalWorldsNavMode.ts
 */

import {
	useCallback,
	useEffect,
	useMemo,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { runtimeModuleKeyForView } from '../activeViewModules';
import {
	laneHasSignal,
	mergeLanePreview,
} from '../components/ProfessionalWorldsBackgroundStreamBanner';
import {
	filterNavItemsForMode,
	isViewVisibleInNavMode,
	suggestFullNavMode,
	toggleNavMode,
	writeStoredNavMode,
	type ProfessionalWorldsNavMode,
} from '../professionalWorldsNavMode';
import type { ProfessionalWorldsRuntimeNavItem } from '../ProfessionalWorldsRuntimeShell';
import {
	findRuntimeModule,
	resolveRuntimeModuleUserLabel,
} from '../verticalModuleLogic';
import type { ProfessionalWorldsActiveView } from '../ProfessionalWorldsWorkspaceContext';
import { shouldShowNonRealtorVerticalNotice } from '../verticalRuntimeNoticeLogic';
import { playbooksModuleKeyForVertical } from '../verticalConstants';
import { buildVerticalDashboardMetrics } from '../verticalDashboardMetrics';
import {
	filterNavItemsForMobileEmbedded,
	isMobileEmbeddedViewAllowed,
} from '../mobileEmbeddedViews';
import {
	deriveAutoCompletableOnboardingSteps,
	extractOnboardingCompletedSteps,
	isOnboardingWizardComplete,
} from '../onboardingWizardLogic';
import type { useProfessionalWorldsAiStreams } from './useProfessionalWorldsAiStreams';
import type { useProfessionalWorldsBootstrap } from './useProfessionalWorldsBootstrap';

type BootstrapState = ReturnType<typeof useProfessionalWorldsBootstrap>;
type AiStreamsState = ReturnType<typeof useProfessionalWorldsAiStreams>;

export type ProfessionalWorldsNavigationModelInput = {
	embeddedMobileLayout: boolean;
	activeView: ProfessionalWorldsActiveView;
	setActiveView: (view: ProfessionalWorldsActiveView) => void;
	navMode: ProfessionalWorldsNavMode;
	setNavMode: Dispatch<SetStateAction<ProfessionalWorldsNavMode>>;
	snapshot: BootstrapState['snapshot'];
	activeVerticalSlug: BootstrapState['activeVerticalSlug'];
	listingWorkspaceEnabled: boolean;
	verticalAddonPanels: ReturnType<
		typeof import('../verticalModuleLogic').sortedEnabledVerticalAddonModules
	>;
	activeRuntimeConfig: BootstrapState['snapshot']['runtimeConfig'];
	activeVertical: BootstrapState['snapshot']['verticals'][number] | null;
	activeActivation:
		| BootstrapState['snapshot']['verticalActivations'][number]
		| null;
	isModuleEnabled: (moduleKey: string) => boolean;
	handlePatchOnboarding: (onboarding: Record<string, unknown>) => Promise<void>;
	onboardingProfileReady: boolean;
	listingStream: AiStreamsState['listingStream'];
	brandStream: AiStreamsState['brandStream'];
	learningStream: AiStreamsState['learningStream'];
};

export function useProfessionalWorldsNavigationModel(
	input: ProfessionalWorldsNavigationModelInput
) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		embeddedMobileLayout,
		activeView,
		setActiveView,
		navMode,
		setNavMode,
		snapshot,
		activeVerticalSlug,
		listingWorkspaceEnabled,
		verticalAddonPanels,
		activeRuntimeConfig,
		activeVertical,
		activeActivation,
		isModuleEnabled,
		handlePatchOnboarding,
		onboardingProfileReady,
		listingStream,
		brandStream,
		learningStream,
	} = input;

	const resolveLockedNavHint = useCallback(
		(moduleKey: string, navFallback: string) => {
			const runtimeModule = findRuntimeModule(
				activeRuntimeConfig?.modules,
				moduleKey
			);
			return t('nav.lockedHint', {
				moduleLabel: resolveRuntimeModuleUserLabel(
					t,
					moduleKey,
					runtimeModule,
					navFallback
				),
			});
		},
		[activeRuntimeConfig?.modules, t]
	);

	const handleToggleNavMode = useCallback(() => {
		setNavMode((prev) => {
			const next = toggleNavMode(prev);
			writeStoredNavMode(next);
			return next;
		});
	}, [setNavMode]);

	useEffect(() => {
		if (navMode === 'full') return;
		if (!isViewVisibleInNavMode(activeView, navMode)) {
			setActiveView('overview');
		}
	}, [activeView, navMode, setActiveView]);

	useEffect(() => {
		if (activeView === 'properties' && !listingWorkspaceEnabled) {
			setActiveView('overview');
			return;
		}
		if (activeView === 'professionTools' && verticalAddonPanels.length === 0) {
			setActiveView('clients');
			return;
		}
		if (activeView === 'playbooks') {
			const playbooksModuleKey =
				playbooksModuleKeyForVertical(activeVerticalSlug);
			const hasPlaybooks = (activeRuntimeConfig?.playbooks?.length ?? 0) > 0;
			if (!hasPlaybooks || !isModuleEnabled(playbooksModuleKey)) {
				setActiveView('overview');
				return;
			}
		}
		const key = runtimeModuleKeyForView(activeView, activeVerticalSlug);
		if (!key) return;
		if (!isModuleEnabled(key)) setActiveView('overview');
	}, [
		activeRuntimeConfig?.playbooks,
		activeVerticalSlug,
		activeView,
		isModuleEnabled,
		listingWorkspaceEnabled,
		setActiveView,
		verticalAddonPanels.length,
	]);

	useEffect(() => {
		if (!embeddedMobileLayout) return;
		if (!isMobileEmbeddedViewAllowed(activeView)) setActiveView('overview');
	}, [activeView, embeddedMobileLayout, setActiveView]);

	const allNavItems = useMemo(() => {
		const items: {
			id: ProfessionalWorldsActiveView;
			label: string;
			moduleKey?: string;
		}[] = [
			{ id: 'overview', label: t('nav.overview') },
			{ id: 'profile', label: t('nav.profile'), moduleKey: 'profile' },
		];
		if (listingWorkspaceEnabled) {
			items.push({
				id: 'properties',
				label: t('nav.properties'),
				moduleKey: 'objects',
			});
		}
		items.push({
			id: 'clients',
			label: t('nav.clients'),
			moduleKey: 'clients',
		});
		if (verticalAddonPanels.length > 0) {
			items.push({
				id: 'professionTools',
				label: t('nav.professionTools', {
					profession: activeVertical?.name ?? activeVerticalSlug,
				}),
			});
		}
		items.push(
			{
				id: 'learning',
				label: t('nav.learning'),
				moduleKey: 'learning',
			},
			{
				id: 'brand',
				label: t('nav.brand'),
				moduleKey: 'public-presence',
			},
			{
				id: 'playbooks',
				label: t('nav.playbooks'),
				moduleKey: playbooksModuleKeyForVertical(activeVerticalSlug),
			},
			{
				id: 'artifacts',
				label: t('nav.artifacts'),
				moduleKey: 'artifacts',
			}
		);
		return items;
	}, [
		activeVertical?.name,
		activeVerticalSlug,
		listingWorkspaceEnabled,
		t,
		verticalAddonPanels.length,
	]);

	const navItems =
		useMemo((): ProfessionalWorldsRuntimeNavItem<ProfessionalWorldsActiveView>[] => {
			const out: ProfessionalWorldsRuntimeNavItem<ProfessionalWorldsActiveView>[] =
				[];
			for (const item of allNavItems) {
				if (item.id === 'playbooks') {
					if (!(activeRuntimeConfig?.playbooks?.length ?? 0)) continue;
					const playbooksModuleKey =
						playbooksModuleKeyForVertical(activeVerticalSlug);
					const enabled = isModuleEnabled(playbooksModuleKey);
					const lockReason = enabled
						? undefined
						: resolveLockedNavHint(playbooksModuleKey, item.label);
					out.push({
						id: item.id,
						label: item.label,
						disabled: !enabled,
						locked: !enabled,
						lockReason,
						title: lockReason,
					});
					continue;
				}
				if (!item.moduleKey) {
					out.push({ id: item.id, label: item.label });
					continue;
				}
				const enabled = isModuleEnabled(item.moduleKey);
				const lockReason = enabled
					? undefined
					: resolveLockedNavHint(item.moduleKey, item.label);
				out.push({
					id: item.id,
					label: item.label,
					disabled: !enabled,
					locked: !enabled,
					lockReason,
					title: lockReason,
				});
			}
			return filterNavItemsForMode(
				embeddedMobileLayout ? filterNavItemsForMobileEmbedded(out) : out,
				navMode
			);
		}, [
			activeRuntimeConfig?.playbooks,
			activeVerticalSlug,
			allNavItems,
			embeddedMobileLayout,
			isModuleEnabled,
			navMode,
			resolveLockedNavHint,
		]);

	const navExpandSuggested = useMemo(() => {
		if (!activeActivation) return false;
		const metrics = buildVerticalDashboardMetrics({
			verticalSlug: activeVerticalSlug,
			profile: snapshot.profile,
			properties: snapshot.properties,
			clients: snapshot.clients,
			deals: snapshot.deals,
			courses: snapshot.courses,
			artifacts: snapshot.artifacts,
		});
		return suggestFullNavMode({
			profileReady: metrics.profileReady,
			onboardingComplete: isOnboardingWizardComplete(
				activeActivation.onboarding
			),
			propertiesCount: snapshot.properties.length,
		});
	}, [
		activeActivation,
		activeVerticalSlug,
		snapshot.artifacts,
		snapshot.clients,
		snapshot.courses,
		snapshot.deals,
		snapshot.profile,
		snapshot.properties,
	]);

	useEffect(() => {
		if (!activeActivation) return;
		const completed = extractOnboardingCompletedSteps(
			activeActivation.onboarding ?? {}
		);
		const pending = deriveAutoCompletableOnboardingSteps({
			profileReady: onboardingProfileReady,
			propertiesCount: snapshot.properties.length,
			artifactsCount: snapshot.artifacts.length,
			completedSteps: completed,
		});
		if (pending.length === 0) return;
		const nextCompleted = new Set([...completed, ...pending]);
		void handlePatchOnboarding({
			...(activeActivation.onboarding ?? {}),
			completed_steps: [...nextCompleted],
		});
	}, [
		activeActivation,
		handlePatchOnboarding,
		onboardingProfileReady,
		snapshot.artifacts.length,
		snapshot.properties.length,
	]);

	const backgroundStreamPeek = useMemo(() => {
		if (activeView !== 'properties' && laneHasSignal(listingStream)) {
			return {
				laneLabel: t('ai.peekListing'),
				preview: mergeLanePreview(listingStream),
				hint: t('ai.peekHint'),
				jumpLabel: t('ai.peekJump'),
				onJump: () => setActiveView('properties'),
			};
		}
		if (activeView !== 'brand' && laneHasSignal(brandStream)) {
			return {
				laneLabel: t('ai.peekBrand'),
				preview: mergeLanePreview(brandStream),
				hint: t('ai.peekHint'),
				jumpLabel: t('ai.peekJump'),
				onJump: () => setActiveView('brand'),
			};
		}
		if (activeView !== 'learning' && laneHasSignal(learningStream)) {
			return {
				laneLabel: t('ai.peekLearning'),
				preview: mergeLanePreview(learningStream),
				hint: t('ai.peekHint'),
				jumpLabel: t('ai.peekJump'),
				onJump: () => setActiveView('learning'),
			};
		}
		return null;
	}, [
		activeView,
		brandStream,
		learningStream,
		listingStream,
		setActiveView,
		t,
	]);

	const nonRealtorVerticalNotice = useMemo(() => {
		if (
			!shouldShowNonRealtorVerticalNotice({
				activeVerticalSlug,
				hasRuntimeConfig: snapshot.runtimeConfigs.length > 0,
			})
		) {
			return null;
		}
		return t('runtime.nonRealtorVerticalNotice', {
			profession: activeVertical?.name ?? activeVerticalSlug,
		});
	}, [
		activeVertical?.name,
		activeVerticalSlug,
		snapshot.runtimeConfigs.length,
		t,
	]);

	return {
		navItems,
		navExpandSuggested,
		backgroundStreamPeek,
		nonRealtorVerticalNotice,
		handleToggleNavMode,
	};
}
