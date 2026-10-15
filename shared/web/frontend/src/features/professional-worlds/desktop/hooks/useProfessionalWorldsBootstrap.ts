/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Snapshot bootstrap for Professional Worlds desktop: vertical activation, runtime config load, and rollout cache notice.
 *
 * Invariants:
 * - Refresh requests are sequenced; stale responses never overwrite newer snapshot state.
 * - Runtime config cache reads are best-effort; API load remains authoritative.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - api.ts
 * - runtimeConfigCache.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	activateProfessionalVertical,
	loadProfessionalWorldsSnapshot,
} from '../api';
import { formatProfessionalWorldsApiError } from '../professionalWorldsApiError';
import { emptySpecialistProfileDraft } from '../profileDraftDefaults';
import { readLatestProfessionalRuntimeConfigCache } from '../runtimeConfigCache';
import { useProfessionalToasts } from '../ProfessionalToast';
import type {
	ProfessionalWorldsSnapshot,
	SpecialistProfileUpsert,
} from '../types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from '../types';
import { resolveActiveVerticalSlug } from '../verticalConstants';

export const EMPTY_PROFESSIONAL_WORLDS_SNAPSHOT: ProfessionalWorldsSnapshot = {
	verticals: [],
	runtimeConfig: null,
	runtimeConfigs: [],
	verticalActivations: [],
	profile: null,
	properties: [],
	clients: [],
	deals: [],
	courses: [],
	artifacts: [],
};

export function useProfessionalWorldsBootstrap() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifySuccess } = useProfessionalToasts();
	const [activeVerticalSlug, setActiveVerticalSlug] = useState(
		PROFESSIONAL_WORLDS_VERTICAL_REALTOR
	);
	const [snapshot, setSnapshot] = useState<ProfessionalWorldsSnapshot>(
		EMPTY_PROFESSIONAL_WORLDS_SNAPSHOT
	);
	const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
		null
	);
	const [profileDraft, setProfileDraft] = useState<SpecialistProfileUpsert>(
		() => emptySpecialistProfileDraft(PROFESSIONAL_WORLDS_VERTICAL_REALTOR)
	);
	const [activationBusySlug, setActivationBusySlug] = useState<string | null>(
		null
	);
	const [activationError, setActivationError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null);
	const refreshRequestSeqRef = useRef(0);

	const patchSnapshot = useCallback(
		(
			recipe: (
				current: ProfessionalWorldsSnapshot
			) => ProfessionalWorldsSnapshot
		) => {
			setSnapshot((current) => recipe(current));
		},
		[]
	);

	const refresh = useCallback(
		async (options?: { verticalSlug?: string; silent?: boolean }) => {
			const slug = options?.verticalSlug ?? activeVerticalSlug;
			const silent = options?.silent === true;
			const requestSeq = refreshRequestSeqRef.current + 1;
			refreshRequestSeqRef.current = requestSeq;
			if (!silent) {
				setLoading(true);
			}
			setError(null);
			try {
				const cachedRuntimeConfig =
					readLatestProfessionalRuntimeConfigCache(slug);
				const next = await loadProfessionalWorldsSnapshot(slug);
				if (requestSeq !== refreshRequestSeqRef.current) {
					return;
				}
				setSnapshot(next);
				const resolvedSlug = resolveActiveVerticalSlug(
					next.verticalActivations,
					slug
				);
				setActiveVerticalSlug(resolvedSlug);
				setSelectedPropertyId((currentId) => {
					const ids = new Set(next.properties.map((property) => property.id));
					if (currentId && ids.has(currentId)) {
						return currentId;
					}
					return next.properties[0]?.id ?? null;
				});
				if (
					next.runtimeConfigs.length > 0 &&
					!next.runtimeConfigs.some((config) => config.vertical_slug === slug)
				) {
					setActiveVerticalSlug(next.runtimeConfigs[0].vertical_slug);
				}
				const previousHash = cachedRuntimeConfig?.config_version_hash;
				const nextHash = next.runtimeConfig?.config_version_hash;
				setRuntimeNotice(
					previousHash && nextHash && previousHash !== nextHash
						? t('runtime.rolloutNotice')
						: null
				);
				if (next.profile) {
					setProfileDraft({
						vertical_slug: next.profile.vertical_slug,
						display_name: next.profile.display_name ?? '',
						headline: next.profile.headline ?? '',
						city: next.profile.city ?? '',
						agency_name: next.profile.agency_name ?? '',
						specialization:
							Array.isArray(next.profile.specialization) &&
							next.profile.specialization.length
								? next.profile.specialization
								: [],
						profile_data:
							next.profile.profile_data &&
							typeof next.profile.profile_data === 'object'
								? (next.profile.profile_data as Record<string, unknown>)
								: {},
						is_public_ready: next.profile.is_public_ready,
					});
				} else {
					setProfileDraft(emptySpecialistProfileDraft(slug));
				}
			} catch (caught) {
				if (requestSeq !== refreshRequestSeqRef.current) {
					return;
				}
				setError(
					formatProfessionalWorldsApiError(
						caught,
						(key) => t(key),
						t('errors.load')
					)
				);
			} finally {
				if (requestSeq === refreshRequestSeqRef.current && !silent) {
					setLoading(false);
				}
			}
		},
		[activeVerticalSlug, t]
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const activeRuntimeSlugs = useMemo(
		() => new Set(snapshot.runtimeConfigs.map((c) => c.vertical_slug)),
		[snapshot.runtimeConfigs]
	);

	const handleActivateVertical = useCallback(
		async (slug: string) => {
			setActivationBusySlug(slug);
			setActivationError(null);
			try {
				await activateProfessionalVertical(slug, true);
				setActiveVerticalSlug(slug);
				await refresh({ verticalSlug: slug });
			} catch (caught: unknown) {
				const msg =
					caught instanceof Error
						? caught.message
						: typeof caught === 'string'
							? caught
							: t('activationGate.activationFailed');
				setActivationError(msg);
			} finally {
				setActivationBusySlug(null);
			}
		},
		[refresh, t]
	);

	const handleVerticalToolbarPick = useCallback(
		(slug: string) => {
			if (slug === activeVerticalSlug) return;
			setActivationError(null);
			const verticalName =
				snapshot.verticals.find((vertical) => vertical.slug === slug)?.name ??
				slug;
			if (activeRuntimeSlugs.has(slug)) {
				setActiveVerticalSlug(slug);
				void refresh({ verticalSlug: slug, silent: true });
				notifySuccess(t('verticalSwitcher.switched', { name: verticalName }));
			} else {
				void handleActivateVertical(slug);
			}
		},
		[
			activeRuntimeSlugs,
			activeVerticalSlug,
			handleActivateVertical,
			notifySuccess,
			refresh,
			snapshot.verticals,
			t,
		]
	);

	const verticalToolbarOptions = useMemo(
		() =>
			snapshot.verticals.map((vertical) => ({
				slug: vertical.slug,
				label: vertical.name,
				needsActivation: !activeRuntimeSlugs.has(vertical.slug),
			})),
		[activeRuntimeSlugs, snapshot.verticals]
	);

	return {
		snapshot,
		patchSnapshot,
		loading,
		error,
		runtimeNotice,
		activeVerticalSlug,
		setActiveVerticalSlug,
		selectedPropertyId,
		setSelectedPropertyId,
		profileDraft,
		setProfileDraft,
		activationBusySlug,
		activationError,
		refresh,
		handleActivateVertical,
		handleVerticalToolbarPick,
		verticalToolbarOptions,
		activeRuntimeSlugs,
	};
}
