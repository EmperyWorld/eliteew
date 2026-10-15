/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map aggregated `/me/snapshot` API rows to Desktop snapshot state and patch helpers for local updates (clients, deals, properties, artifacts, learning progress).
 *
 * Invariants:
 * - Patch helpers prepend or replace by stable entity id without mutating unrelated snapshot slices (clients, deals, properties, artifacts, activations, learning progress).
 *
 * Related:
 * - api.ts
 * - professionalWorldsOpenApi.ts
 * - ProfessionalWorldsApp.tsx
 */

import type { ProfessionalWorldsSnapshotOut } from './professionalWorldsOpenApi';
import type {
	ProfessionalArtifact,
	ProfessionalClient,
	ProfessionalDeal,
	ProfessionalUserVerticalActivation,
	ProfessionalWorldsSnapshot,
	RealtorProperty,
	SpecialistProfile,
} from './types';

export type ProfessionalWorldsSnapshotApiRow = ProfessionalWorldsSnapshotOut;

export function mapProfessionalWorldsSnapshotApiRow(
	row: ProfessionalWorldsSnapshotApiRow
): ProfessionalWorldsSnapshot {
	return {
		verticals: row.verticals ?? [],
		runtimeConfig: row.runtime_config ?? null,
		runtimeConfigs: row.runtime_configs ?? [],
		verticalActivations: row.vertical_activations ?? [],
		profile: row.profile ?? null,
		properties: row.properties ?? [],
		clients: row.clients ?? [],
		deals: row.deals ?? [],
		courses: row.courses ?? [],
		artifacts: row.artifacts ?? [],
		providerHealth: row.provider_health
			? {
					ugsOk: row.provider_health.ugs_ok,
					degraded: row.provider_health.degraded,
					message: row.provider_health.message ?? '',
				}
			: null,
	};
}

export function prependClientToSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	client: ProfessionalClient
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		clients: [
			client,
			...snapshot.clients.filter((item) => item.id !== client.id),
		],
	};
}

export function prependDealToSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	deal: ProfessionalDeal
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		deals: [deal, ...snapshot.deals.filter((item) => item.id !== deal.id)],
	};
}

export function prependPropertyToSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	property: RealtorProperty
): ProfessionalWorldsSnapshot {
	return upsertPropertyInSnapshot(snapshot, property, { prependIfNew: true });
}

export function upsertPropertyInSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	property: RealtorProperty,
	options?: { prependIfNew?: boolean }
): ProfessionalWorldsSnapshot {
	const exists = snapshot.properties.some((item) => item.id === property.id);
	if (exists) {
		return {
			...snapshot,
			properties: snapshot.properties.map((item) =>
				item.id === property.id ? property : item
			),
		};
	}
	return {
		...snapshot,
		properties: options?.prependIfNew
			? [property, ...snapshot.properties]
			: [...snapshot.properties, property],
	};
}

export function markLessonCompletedInSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	lessonId: string
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		courses: snapshot.courses.map((course) => ({
			...course,
			lessons: (course.lessons ?? []).map((lesson) =>
				lesson.id === lessonId ? { ...lesson, completed: true } : lesson
			),
		})),
	};
}

export function upsertProfileInSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	profile: SpecialistProfile
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		profile,
	};
}

export function upsertVerticalActivationInSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	activation: ProfessionalUserVerticalActivation
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		verticalActivations: [
			activation,
			...snapshot.verticalActivations.filter(
				(item) => item.vertical_slug !== activation.vertical_slug
			),
		],
	};
}

export function upsertArtifactInSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	artifact: ProfessionalArtifact
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		artifacts: [
			artifact,
			...snapshot.artifacts.filter((item) => item.id !== artifact.id),
		],
	};
}

export function removeClientFromSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	clientId: string
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		clients: snapshot.clients.filter((item) => item.id !== clientId),
	};
}

export function removeDealFromSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	dealId: string
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		deals: snapshot.deals.filter((item) => item.id !== dealId),
	};
}

export function removeArtifactFromSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	artifactId: string
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		artifacts: snapshot.artifacts.filter((item) => item.id !== artifactId),
	};
}

export function removePropertyFromSnapshot(
	snapshot: ProfessionalWorldsSnapshot,
	propertyId: string
): ProfessionalWorldsSnapshot {
	return {
		...snapshot,
		properties: snapshot.properties.filter((item) => item.id !== propertyId),
	};
}

export function integrationKeyToPropertyDraftKind(
	integrationKey: string
): 'ewrp' | 'site-studio' | 'gaf-chat' | 'ewdesk' | null {
	const normalized = integrationKey.trim().toLowerCase().replace(/_/g, '-');
	if (normalized === 'ewrp') return 'ewrp';
	if (normalized === 'site-studio') return 'site-studio';
	if (normalized === 'gaf-chat') return 'gaf-chat';
	if (normalized === 'ewdesk') return 'ewdesk';
	return null;
}
