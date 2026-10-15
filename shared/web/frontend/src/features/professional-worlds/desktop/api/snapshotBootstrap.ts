/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime config and snapshot bootstrap (aggregate + fan-out fallback) for Professional Worlds desktop API.
 *
 * Invariants:
 * - Snapshot bootstrap prefers GET /me/snapshot; fan-out GETs remain as fallback when aggregate is unavailable.
 * - Snapshot bootstrap uses the caller's vertical for me/profile, learning/courses, and the primary runtime row.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsSnapshotUtils.ts
 * - ../runtimeConfigCache.ts
 */

import type {
	ProfessionVerticalOut,
	ProfessionalArtifactOut,
	ProfessionalClientOut,
	ProfessionalDealOut,
	ProfessionalLearningCourseOut,
	ProfessionalWorldsMultiRuntimeConfig,
	ProfessionalWorldsRuntimeConfig,
	ProfessionalWorldsSnapshotOut,
	RealtorPropertyOut,
	SpecialistProfileOut,
} from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type { ProfessionalWorldsSnapshot } from '../types';
import {
	parseNullableSpecialistProfileOut,
	parseProfessionVerticalOutList,
	parseProfessionalArtifactOutList,
	parseProfessionalClientOutList,
	parseProfessionalDealOutList,
	parseProfessionalLearningCourseOutList,
	parseProfessionalWorldsMultiRuntimeConfigOut,
	parseProfessionalWorldsRuntimeConfigOut,
	parseProfessionalWorldsSnapshotOut,
	parseRealtorPropertyOutList,
} from '../professionalWorldsApiZod';
import { mapProfessionalWorldsSnapshotApiRow } from '../professionalWorldsSnapshotUtils';
import { cacheProfessionalRuntimeConfig } from '../runtimeConfigCache';
import {
	shouldFetchArtifactsSnapshot,
	shouldFetchClientsSnapshot,
	shouldFetchDealsSnapshot,
	shouldFetchLearningSnapshot,
	shouldFetchProfileSnapshot,
} from '../runtimeModuleMount';
import { verticalSupportsListingWorkspace } from '../verticalModuleLogic';
import {
	getNoCache,
	PROFESSIONAL_WORLDS_API_BASE,
	withNoCacheTs,
} from './httpShared';
import { listProfessionalVerticalActivations } from './verticals';

export async function loadProfessionalWorldsRuntimeConfig(
	verticalSlug = 'realtor'
): Promise<ProfessionalWorldsRuntimeConfig> {
	const config = parseProfessionalWorldsRuntimeConfigOut(
		await api.get<ProfessionalWorldsRuntimeConfig>(
			withNoCacheTs(
				`${PROFESSIONAL_WORLDS_API_BASE}/me/runtime-config?vertical_slug=${encodeURIComponent(verticalSlug)}`
			)
		)
	);
	cacheProfessionalRuntimeConfig(config);
	return config;
}

export async function loadProfessionalWorldsRuntimeConfigs(): Promise<
	ProfessionalWorldsRuntimeConfig[]
> {
	const response = parseProfessionalWorldsMultiRuntimeConfigOut(
		await api.get<ProfessionalWorldsMultiRuntimeConfig>(
			withNoCacheTs(`${PROFESSIONAL_WORLDS_API_BASE}/me/runtime-configs`)
		)
	);
	response.configs.forEach(cacheProfessionalRuntimeConfig);
	return response.configs;
}

export async function loadProfessionalWorldsSnapshot(
	verticalSlug = 'realtor'
): Promise<ProfessionalWorldsSnapshot> {
	const effectiveVerticalSlug = verticalSlug || 'realtor';
	const verticalQuery = encodeURIComponent(effectiveVerticalSlug);
	try {
		const row = parseProfessionalWorldsSnapshotOut(
			await getNoCache<ProfessionalWorldsSnapshotOut>(
				`${PROFESSIONAL_WORLDS_API_BASE}/me/snapshot?vertical_slug=${verticalQuery}`
			)
		);
		for (const config of row.runtime_configs ?? []) {
			cacheProfessionalRuntimeConfig(config);
		}
		if (row.runtime_config) {
			cacheProfessionalRuntimeConfig(row.runtime_config);
		}
		return mapProfessionalWorldsSnapshotApiRow(row);
	} catch (err: unknown) {
		console.warn(
			'[professional-worlds] aggregate snapshot unavailable; falling back to fan-out GETs',
			err
		);
		return loadProfessionalWorldsSnapshotFanOut(effectiveVerticalSlug);
	}
}

async function loadProfessionalWorldsSnapshotFanOut(
	effectiveVerticalSlug: string
): Promise<ProfessionalWorldsSnapshot> {
	const verticalQuery = encodeURIComponent(effectiveVerticalSlug);
	const [verticals, runtimeConfigs, verticalActivations] = await Promise.all([
		parseProfessionVerticalOutList(
			await getNoCache<ProfessionVerticalOut[]>(
				`${PROFESSIONAL_WORLDS_API_BASE}/verticals`
			)
		),
		loadProfessionalWorldsRuntimeConfigs(),
		listProfessionalVerticalActivations(),
	]);
	let resolvedRuntime =
		runtimeConfigs.find(
			(config) => config.vertical_slug === effectiveVerticalSlug
		) ?? null;
	if (!resolvedRuntime) {
		resolvedRuntime = await loadProfessionalWorldsRuntimeConfig(
			effectiveVerticalSlug
		);
	}
	const modules = resolvedRuntime?.modules ?? [];
	const [profile, clients, deals, courses, artifacts] = await Promise.all([
		shouldFetchProfileSnapshot(modules)
			? parseNullableSpecialistProfileOut(
					await getNoCache<SpecialistProfileOut | null>(
						`${PROFESSIONAL_WORLDS_API_BASE}/me/profile?vertical_slug=${verticalQuery}`
					)
				)
			: Promise.resolve(null),
		shouldFetchClientsSnapshot(modules)
			? parseProfessionalClientOutList(
					await getNoCache<ProfessionalClientOut[]>(
						`${PROFESSIONAL_WORLDS_API_BASE}/clients?vertical_slug=${verticalQuery}`
					)
				)
			: Promise.resolve([]),
		shouldFetchDealsSnapshot(modules)
			? parseProfessionalDealOutList(
					await getNoCache<ProfessionalDealOut[]>(
						`${PROFESSIONAL_WORLDS_API_BASE}/deals?vertical_slug=${verticalQuery}`
					)
				)
			: Promise.resolve([]),
		shouldFetchLearningSnapshot(modules)
			? parseProfessionalLearningCourseOutList(
					await getNoCache<ProfessionalLearningCourseOut[]>(
						`${PROFESSIONAL_WORLDS_API_BASE}/learning/courses?vertical_slug=${verticalQuery}`
					)
				)
			: Promise.resolve([]),
		shouldFetchArtifactsSnapshot(modules)
			? parseProfessionalArtifactOutList(
					await getNoCache<ProfessionalArtifactOut[]>(
						`${PROFESSIONAL_WORLDS_API_BASE}/artifacts?vertical_slug=${verticalQuery}`
					)
				)
			: Promise.resolve([]),
	]);
	const properties = verticalSupportsListingWorkspace(
		effectiveVerticalSlug,
		modules
	)
		? parseRealtorPropertyOutList(
				await getNoCache<RealtorPropertyOut[]>(
					`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties`
				)
			)
		: [];
	return {
		verticals,
		runtimeConfig: resolvedRuntime,
		runtimeConfigs,
		verticalActivations,
		profile,
		properties,
		clients,
		deals,
		courses,
		artifacts,
	};
}
