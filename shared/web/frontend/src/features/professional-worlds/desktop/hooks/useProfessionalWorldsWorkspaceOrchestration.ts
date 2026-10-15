/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace orchestration for Professional Worlds desktop: CRM drafts, AI streams, focus state, and workspace context.
 *
 * Invariants:
 * - Snapshot mutations go through `patchSnapshot` helpers; optimistic client create rolls back on failure.
 * - Workspace context exposes navigation helpers without leaking shell chrome concerns.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - hooks/useProfessionalWorldsNavigationModel.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	createProfessionalClient,
	createProfessionalDeal,
	patchProfessionalVerticalOnboarding,
	saveSpecialistProfile,
	streamCoachSimulation,
} from '../api';
import { useProfessionalWorldsAiStreams } from './useProfessionalWorldsAiStreams';
import type { useProfessionalWorldsBootstrap } from './useProfessionalWorldsBootstrap';
import {
	prependClientToSnapshot,
	prependDealToSnapshot,
	upsertArtifactInSnapshot,
	upsertProfileInSnapshot,
	upsertVerticalActivationInSnapshot,
} from '../professionalWorldsSnapshotUtils';
import {
	findRuntimeModule,
	sortedEnabledVerticalAddonModules,
	verticalSupportsListingWorkspace,
} from '../verticalModuleLogic';
import {
	isRuntimeModuleEnabled,
	resolveRuntimePhotoPresets,
} from '../runtimeModuleMount';
import type {
	ProfessionalWorldsActiveView,
	ProfessionalWorldsArtifactsWorkspaceFocus,
	ProfessionalWorldsClientsWorkspaceFocus,
	ProfessionalWorldsCommunicationsFocus,
	ProfessionalWorldsPropertiesWorkspaceFocus,
	ProfessionalWorldsShowingsFocus,
	ProfessionalWorldsTasksFocus,
	ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import { PW_FALLBACK_PHOTO_PRESETS } from '../ProfessionalMediaWorkbench';
import {
	buildJtbdPreview,
	buildProfessionalDealCreatePayload,
	ROLEPLAY_SCENARIOS,
	selectRecipeKey,
} from '../realtorLogic';
import { createIdempotencyKey } from '../utils/professionalWorldsFormUtils';
import type {
	ProfessionalArtifact,
	ProfessionalClient,
	ProfessionalClientCreate,
	ProfessionalDealCreate,
} from '../types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from '../types';
import { buildVerticalDashboardMetrics } from '../verticalDashboardMetrics';
import {
	readStoredNavMode,
	type ProfessionalWorldsNavMode,
} from '../professionalWorldsNavMode';
import type { ProfessionalWorldsNavigationModelInput } from './useProfessionalWorldsNavigationModel';

type BootstrapState = ReturnType<typeof useProfessionalWorldsBootstrap>;

function clientBudgetOutValue(
	value: string | number | null | undefined
): string | null | undefined {
	if (value == null) {
		return null;
	}
	return String(value);
}

function snapshotOwnerUserId(
	snapshot: ReturnType<typeof useProfessionalWorldsBootstrap>['snapshot']
): string {
	return (
		snapshot.profile?.user_id ??
		snapshot.clients[0]?.user_id ??
		snapshot.deals[0]?.user_id ??
		'00000000-0000-4000-8000-000000000000'
	);
}

export function useProfessionalWorldsWorkspaceOrchestration(
	bootstrap: BootstrapState,
	embeddedMobileLayout: boolean
) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		snapshot,
		patchSnapshot,
		activeVerticalSlug,
		selectedPropertyId,
		setSelectedPropertyId,
		profileDraft,
		setProfileDraft,
		refresh,
	} = bootstrap;

	const [activeView, setActiveView] =
		useState<ProfessionalWorldsActiveView>('overview');
	const [navMode, setNavMode] = useState<ProfessionalWorldsNavMode>(() =>
		readStoredNavMode()
	);
	const [professionToolFocusModuleKey, setProfessionToolFocusModuleKey] =
		useState<string | null>(null);
	const [pipelineFocusDealId, setPipelineFocusDealId] = useState<string | null>(
		null
	);
	const [communicationsFocus, setCommunicationsFocus] =
		useState<ProfessionalWorldsCommunicationsFocus | null>(null);
	const [showingsFocus, setShowingsFocus] =
		useState<ProfessionalWorldsShowingsFocus | null>(null);
	const [tasksFocus, setTasksFocus] =
		useState<ProfessionalWorldsTasksFocus | null>(null);
	const [artifactsWorkspaceFocus, setArtifactsWorkspaceFocus] =
		useState<ProfessionalWorldsArtifactsWorkspaceFocus | null>(null);
	const [clientsWorkspaceFocus, setClientsWorkspaceFocus] =
		useState<ProfessionalWorldsClientsWorkspaceFocus | null>(null);
	const [propertiesWorkspaceFocus, setPropertiesWorkspaceFocus] =
		useState<ProfessionalWorldsPropertiesWorkspaceFocus | null>(null);
	const [clientDraft, setClientDraft] = useState<ProfessionalClientCreate>({
		vertical_slug: PROFESSIONAL_WORLDS_VERTICAL_REALTOR,
		name: '',
		contact: '',
		need_summary: '',
		budget_from: null,
		budget_to: null,
		preferred_areas: [],
		emotional_motive: '',
		next_action: '',
		status: 'lead',
	});
	const [dealDraft, setDealDraft] = useState<ProfessionalDealCreate>(() => ({
		vertical_slug: PROFESSIONAL_WORLDS_VERTICAL_REALTOR,
		client_id: null,
		title: '',
		stage: 'new',
		amount: null,
		next_action: '',
		deal_data: {},
	}));
	const {
		listingStream,
		brandStream,
		learningStream,
		setLaneText,
		setLaneStatus,
	} = useProfessionalWorldsAiStreams();
	const [profileBanner, setProfileBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const [clientsBanner, setClientsBanner] = useState<{
		kind: 'success' | 'error';
		text: string;
	} | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setClientDraft((current) =>
			current.vertical_slug === activeVerticalSlug
				? current
				: { ...current, vertical_slug: activeVerticalSlug }
		);
		setDealDraft((current) =>
			current.vertical_slug === activeVerticalSlug
				? current
				: { ...current, vertical_slug: activeVerticalSlug }
		);
	}, [activeVerticalSlug]);

	const selectedProperty = useMemo(() => {
		if (!selectedPropertyId) return null;
		return (
			snapshot.properties.find(
				(property) => property.id === selectedPropertyId
			) ?? null
		);
	}, [snapshot.properties, selectedPropertyId]);

	const addArtifactToSnapshot = useCallback(
		(artifact?: ProfessionalArtifact) => {
			if (!artifact) return;
			patchSnapshot((current) => upsertArtifactInSnapshot(current, artifact));
		},
		[patchSnapshot]
	);

	const handleSaveProfile = useCallback(async () => {
		setSaving(true);
		setProfileBanner(null);
		try {
			const saved = await saveSpecialistProfile(profileDraft);
			patchSnapshot((current) => upsertProfileInSnapshot(current, saved));
			setProfileDraft({
				vertical_slug: saved.vertical_slug,
				display_name: saved.display_name ?? '',
				headline: saved.headline ?? '',
				city: saved.city ?? '',
				agency_name: saved.agency_name ?? '',
				specialization:
					Array.isArray(saved.specialization) && saved.specialization.length
						? saved.specialization
						: [],
				profile_data:
					saved.profile_data && typeof saved.profile_data === 'object'
						? (saved.profile_data as Record<string, unknown>)
						: {},
				is_public_ready: saved.is_public_ready,
			});
			setProfileBanner({ kind: 'success', text: t('profile.saved') });
		} catch (caught: unknown) {
			const msg =
				caught instanceof Error
					? caught.message
					: typeof caught === 'string'
						? caught
						: t('profile.saveErrorDetail');
			setProfileBanner({
				kind: 'error',
				text: `${t('profile.saveFailed')}: ${msg}`,
			});
		} finally {
			setSaving(false);
		}
	}, [profileDraft, patchSnapshot, setProfileDraft, t]);

	const handleCreateClient = useCallback(async () => {
		setSaving(true);
		setClientsBanner(null);
		const pendingId = `pending-client-${Date.now()}`;
		const optimisticClient: ProfessionalClient = {
			id: pendingId,
			user_id: snapshotOwnerUserId(snapshot),
			vertical_slug: activeVerticalSlug,
			name: clientDraft.name,
			contact: clientDraft.contact ?? '',
			need_summary: clientDraft.need_summary ?? '',
			budget_from: clientBudgetOutValue(clientDraft.budget_from),
			budget_to: clientBudgetOutValue(clientDraft.budget_to),
			preferred_areas: clientDraft.preferred_areas ?? [],
			emotional_motive: clientDraft.emotional_motive ?? '',
			next_action: clientDraft.next_action ?? '',
			status: clientDraft.status ?? 'lead',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		patchSnapshot((current) =>
			prependClientToSnapshot(current, optimisticClient)
		);
		try {
			const saved = await createProfessionalClient(clientDraft);
			setClientDraft({
				vertical_slug: activeVerticalSlug,
				name: '',
				contact: '',
				need_summary: '',
				budget_from: null,
				budget_to: null,
				preferred_areas: [],
				emotional_motive: '',
				next_action: '',
				status: 'lead',
			});
			patchSnapshot((current) => {
				const withoutPending = {
					...current,
					clients: current.clients.filter((client) => client.id !== pendingId),
				};
				return prependClientToSnapshot(withoutPending, saved);
			});
			setDealDraft((current) => ({
				...current,
				vertical_slug: activeVerticalSlug,
				client_id: saved.id,
			}));
			setClientsBanner({ kind: 'success', text: t('clients.saved') });
		} catch (caught: unknown) {
			patchSnapshot((current) => ({
				...current,
				clients: current.clients.filter((client) => client.id !== pendingId),
			}));
			const msg =
				caught instanceof Error
					? caught.message
					: typeof caught === 'string'
						? caught
						: t('clients.saveFailedDetail');
			setClientsBanner({
				kind: 'error',
				text: `${t('clients.saveFailed')}: ${msg}`,
			});
		} finally {
			setSaving(false);
		}
	}, [activeVerticalSlug, clientDraft, patchSnapshot, snapshot, t]);

	const handleCreateDeal = useCallback(async () => {
		setSaving(true);
		setClientsBanner(null);
		try {
			const saved = await createProfessionalDeal(
				buildProfessionalDealCreatePayload(dealDraft, {
					linkedPropertyId: selectedPropertyId,
				})
			);
			setDealDraft({
				vertical_slug: activeVerticalSlug,
				client_id: null,
				title: '',
				stage: 'new',
				amount: null,
				next_action: '',
				deal_data: {},
			});
			patchSnapshot((current) => prependDealToSnapshot(current, saved));
			const linkedClientId = saved.client_id?.trim() ?? null;
			if (linkedClientId) {
				setClientsWorkspaceFocus({
					tab: 'directory',
					filterClientId: linkedClientId,
				});
			}
			setClientsBanner({ kind: 'success', text: t('deals.saved') });
		} catch (caught: unknown) {
			const msg =
				caught instanceof Error
					? caught.message
					: typeof caught === 'string'
						? caught
						: t('deals.saveFailedDetail');
			setClientsBanner({
				kind: 'error',
				text: `${t('deals.saveFailed')}: ${msg}`,
			});
		} finally {
			setSaving(false);
		}
	}, [activeVerticalSlug, dealDraft, patchSnapshot, selectedPropertyId, t]);

	const handleStartCoach = useCallback(
		async (scenario: (typeof ROLEPLAY_SCENARIOS)[number], message: string) => {
			if (!message.trim()) return;
			setLaneText('learning', '');
			setLaneStatus('learning', t('stream.starting'));
			await streamCoachSimulation(
				{
					scenario,
					user_message: message,
					idempotency_key: createIdempotencyKey(selectRecipeKey('roleplay')),
				},
				{
					onStarted: (requestId) =>
						setLaneStatus('learning', `${t('stream.started')} ${requestId}`),
					onProgress: (progressMessage) =>
						setLaneStatus('learning', progressMessage),
					onResult: (text, artifact) => {
						setLaneText('learning', text);
						addArtifactToSnapshot(artifact);
						setLaneStatus('learning', t('stream.done'));
					},
					onError: (errorMessage) =>
						setLaneStatus('learning', `${t('stream.error')}: ${errorMessage}`),
				}
			);
		},
		[addArtifactToSnapshot, setLaneStatus, setLaneText, t]
	);

	const copyLane = useCallback(
		async (lane: 'listing' | 'brand' | 'learning') => {
			const text =
				lane === 'listing'
					? listingStream.text
					: lane === 'brand'
						? brandStream.text
						: learningStream.text;
			if (!text.trim()) return;
			await navigator.clipboard?.writeText(text);
			setLaneStatus(lane, t('stream.copied'));
		},
		[
			brandStream.text,
			learningStream.text,
			listingStream.text,
			setLaneStatus,
			t,
		]
	);

	const activeRuntimeConfig = useMemo(
		() =>
			snapshot.runtimeConfigs.find(
				(config) => config.vertical_slug === activeVerticalSlug
			) ?? snapshot.runtimeConfig,
		[activeVerticalSlug, snapshot.runtimeConfig, snapshot.runtimeConfigs]
	);

	const listingWorkspaceEnabled = useMemo(
		() =>
			verticalSupportsListingWorkspace(
				activeVerticalSlug,
				activeRuntimeConfig?.modules
			),
		[activeRuntimeConfig?.modules, activeVerticalSlug]
	);

	const resolvedPhotoPresets = useMemo(
		() =>
			resolveRuntimePhotoPresets(
				activeRuntimeConfig?.modules,
				activeRuntimeConfig?.photo_presets,
				PW_FALLBACK_PHOTO_PRESETS
			),
		[activeRuntimeConfig?.modules, activeRuntimeConfig?.photo_presets]
	);

	const mediaStudioEnabled = useMemo(
		() => isRuntimeModuleEnabled(activeRuntimeConfig?.modules, 'media-studio'),
		[activeRuntimeConfig?.modules]
	);

	const dealsModuleEnabled = useMemo(
		() => isRuntimeModuleEnabled(activeRuntimeConfig?.modules, 'deals'),
		[activeRuntimeConfig?.modules]
	);

	const activeVertical = useMemo(
		() =>
			snapshot.verticals.find(
				(vertical) => vertical.slug === activeVerticalSlug
			) ?? null,
		[activeVerticalSlug, snapshot.verticals]
	);

	const activeActivation = useMemo(
		() =>
			snapshot.verticalActivations.find(
				(activation) => activation.vertical_slug === activeVerticalSlug
			) ?? null,
		[activeVerticalSlug, snapshot.verticalActivations]
	);

	const verticalAddonPanels = useMemo(() => {
		const modules = activeRuntimeConfig?.modules ?? [];
		return sortedEnabledVerticalAddonModules(modules, activeVerticalSlug);
	}, [activeRuntimeConfig?.modules, activeVerticalSlug]);

	const handlePatchOnboarding = useCallback(
		async (onboarding: Record<string, unknown>) => {
			try {
				const saved = await patchProfessionalVerticalOnboarding(
					activeVerticalSlug,
					onboarding
				);
				patchSnapshot((current) =>
					upsertVerticalActivationInSnapshot(current, saved)
				);
			} catch (caught: unknown) {
				const msg =
					caught instanceof Error
						? caught.message
						: t('onboardingWizard.saveFailed');
				throw new Error(msg);
			}
		},
		[activeVerticalSlug, patchSnapshot, t]
	);

	const onboardingProfileReady = useMemo(
		() =>
			buildVerticalDashboardMetrics({
				verticalSlug: activeVerticalSlug,
				profile: snapshot.profile,
				properties: snapshot.properties,
				clients: snapshot.clients,
				deals: snapshot.deals,
				courses: snapshot.courses,
				artifacts: snapshot.artifacts,
			}).profileReady,
		[activeVerticalSlug, snapshot]
	);

	const isModuleEnabled = useCallback(
		(moduleKey: string) => {
			const mod = findRuntimeModule(activeRuntimeConfig?.modules, moduleKey);
			return Boolean(mod?.is_enabled);
		},
		[activeRuntimeConfig?.modules]
	);

	const openProfessionTool = useCallback((moduleKey?: string) => {
		if (moduleKey) setProfessionToolFocusModuleKey(moduleKey);
		setActiveView('professionTools');
	}, []);

	const openClients = useCallback(
		(options?: ProfessionalWorldsClientsWorkspaceFocus) => {
			if (options) {
				setClientsWorkspaceFocus(options);
				if (options.dealClientId?.trim()) {
					setDealDraft((current) => ({
						...current,
						client_id: options.dealClientId?.trim() ?? null,
					}));
				}
				if (options.linkedPropertyId?.trim()) {
					setSelectedPropertyId(options.linkedPropertyId.trim());
				}
			}
			setActiveView('clients');
		},
		[setSelectedPropertyId]
	);

	const openProperties = useCallback(
		(options?: ProfessionalWorldsPropertiesWorkspaceFocus) => {
			if (options?.propertyId?.trim()) {
				setSelectedPropertyId(options.propertyId.trim());
			}
			if (options) setPropertiesWorkspaceFocus(options);
			setActiveView('properties');
		},
		[setSelectedPropertyId]
	);

	const openPipeline = useCallback((options?: { dealId?: string | null }) => {
		if (options?.dealId?.trim()) setPipelineFocusDealId(options.dealId.trim());
		setProfessionToolFocusModuleKey('realtor_pipeline');
		setActiveView('professionTools');
	}, []);

	const openShowings = useCallback(
		(options?: { propertyId?: string | null; clientId?: string | null }) => {
			if (options) {
				setShowingsFocus(options);
				if (options.propertyId?.trim()) {
					setSelectedPropertyId(options.propertyId.trim());
				}
			}
			setProfessionToolFocusModuleKey('realtor_showings');
			setActiveView('professionTools');
		},
		[setSelectedPropertyId]
	);

	const openTasks = useCallback(
		(options?: ProfessionalWorldsTasksFocus) => {
			if (options) {
				setTasksFocus(options);
				if (options.propertyId?.trim()) {
					setSelectedPropertyId(options.propertyId.trim());
				}
			}
			setProfessionToolFocusModuleKey('realtor_tasks');
			setActiveView('professionTools');
		},
		[setSelectedPropertyId]
	);

	const openCommunications = useCallback(
		(options?: { relatedType?: string | null; relatedId?: string | null }) => {
			if (options) setCommunicationsFocus(options);
			setProfessionToolFocusModuleKey('realtor_communications');
			setActiveView('professionTools');
		},
		[]
	);

	const openArtifacts = useCallback(
		(options?: ProfessionalWorldsArtifactsWorkspaceFocus) => {
			if (options) setArtifactsWorkspaceFocus(options);
			setActiveView('artifacts');
		},
		[]
	);

	const preparedPresentationBrief = useMemo(() => {
		if (!selectedProperty) return '';
		return `${selectedProperty.title}\n\n${buildJtbdPreview(selectedProperty)}\n\n${listingStream.text}`;
	}, [listingStream.text, selectedProperty]);

	const workspaceContextValue =
		useMemo((): ProfessionalWorldsWorkspaceContextValue => {
			return {
				activeView,
				activeVerticalSlug,
				navigate: setActiveView,
				openClients,
				openProperties,
				openPipeline,
				pipelineFocusDealId,
				consumePipelineFocus: () => setPipelineFocusDealId(null),
				openShowings,
				showingsFocus,
				consumeShowingsFocus: () => setShowingsFocus(null),
				openTasks,
				tasksFocus,
				consumeTasksFocus: () => setTasksFocus(null),
				openCommunications,
				communicationsFocus,
				consumeCommunicationsFocus: () => setCommunicationsFocus(null),
				openArtifacts,
				artifactsWorkspaceFocus,
				consumeArtifactsWorkspaceFocus: () => setArtifactsWorkspaceFocus(null),
				clientsWorkspaceFocus,
				consumeClientsWorkspaceFocus: () => setClientsWorkspaceFocus(null),
				propertiesWorkspaceFocus,
				consumePropertiesWorkspaceFocus: () =>
					setPropertiesWorkspaceFocus(null),
				openProfessionTool,
				professionToolFocusModuleKey,
				consumeProfessionToolFocus: () => setProfessionToolFocusModuleKey(null),
				snapshot,
				refresh,
				reloadSnapshot: refresh,
				saving,
				setSaving,
				selectedPropertyId,
				setSelectedPropertyId,
				selectedProperty,
				listingWorkspaceEnabled,
				activeRuntimeConfig,
				activeActivation,
				activeVertical,
				verticalAddonModules: verticalAddonPanels,
				resolvedPhotoPresets,
				mediaStudioEnabled,
				dealsModuleEnabled,
				preparedPresentationBrief,
				listingStream,
				brandStream,
				learningStream,
				setLaneText,
				setLaneStatus,
				addArtifactToSnapshot,
				patchSnapshot,
				copyLane,
				patchOnboarding: handlePatchOnboarding,
				embeddedMobileLayout,
			};
		}, [
			activeActivation,
			activeRuntimeConfig,
			activeVertical,
			activeVerticalSlug,
			activeView,
			addArtifactToSnapshot,
			artifactsWorkspaceFocus,
			brandStream,
			clientsWorkspaceFocus,
			communicationsFocus,
			copyLane,
			dealsModuleEnabled,
			embeddedMobileLayout,
			handlePatchOnboarding,
			learningStream,
			listingStream,
			listingWorkspaceEnabled,
			mediaStudioEnabled,
			openArtifacts,
			openClients,
			openCommunications,
			openPipeline,
			openProfessionTool,
			openProperties,
			openShowings,
			openTasks,
			patchSnapshot,
			pipelineFocusDealId,
			preparedPresentationBrief,
			professionToolFocusModuleKey,
			propertiesWorkspaceFocus,
			refresh,
			resolvedPhotoPresets,
			saving,
			selectedProperty,
			selectedPropertyId,
			setLaneStatus,
			setLaneText,
			setSelectedPropertyId,
			showingsFocus,
			snapshot,
			tasksFocus,
			verticalAddonPanels,
		]);

	const navigationInput = useMemo(
		(): ProfessionalWorldsNavigationModelInput => ({
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
		}),
		[
			activeActivation,
			activeRuntimeConfig,
			activeVertical,
			activeVerticalSlug,
			activeView,
			brandStream,
			embeddedMobileLayout,
			handlePatchOnboarding,
			isModuleEnabled,
			learningStream,
			listingStream,
			listingWorkspaceEnabled,
			navMode,
			onboardingProfileReady,
			snapshot,
			verticalAddonPanels,
		]
	);

	const hasRuntime = snapshot.runtimeConfigs.length > 0;

	return {
		activeView,
		setActiveView,
		navMode,
		setNavMode,
		workspaceContextValue,
		navigationInput,
		hasRuntime,
		listingWorkspaceEnabled,
		viewRouterProps: {
			activeView,
			activeVerticalSlug,
			hasRuntime,
			listingWorkspaceEnabled,
			snapshot,
			patchSnapshot,
			profileBanner,
			profileDraft,
			setProfileDraft,
			saving,
			onSaveProfile: handleSaveProfile,
			clientDraft,
			setClientDraft,
			dealDraft,
			setDealDraft,
			clientsBanner,
			onCreateClient: handleCreateClient,
			onCreateDeal: handleCreateDeal,
			onStartCoach: handleStartCoach,
		},
	};
}
