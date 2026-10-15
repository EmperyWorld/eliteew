/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve one-click artifact handoff destinations for the Results library without opening the handoff tab.
 *
 * Invariants:
 * - Only property-linked artifacts can create cross-app drafts (matches IntegrationHandoffPanel).
 * - Destination order is stable for UX: presentation → chat → feed → site.
 *
 * Related:
 * - ArtifactHub.tsx
 * - integrationKeyToPropertyDraftKind.ts (professionalWorldsSnapshotUtils.ts)
 */

import { integrationKeyToPropertyDraftKind } from './professionalWorldsSnapshotUtils';
import type {
	ProfessionalArtifact,
	ProfessionalRuntimeIntegration,
} from './types';

export const ARTIFACT_QUICK_HANDOFF_LABEL_KEYS = {
	ewrp: 'runtimeComponents.artifactHub.quickHandoff.ewrp',
	'gaf-chat': 'runtimeComponents.artifactHub.quickHandoff.gafChat',
	ewdesk: 'runtimeComponents.artifactHub.quickHandoff.ewDesk',
	'site-studio': 'runtimeComponents.artifactHub.quickHandoff.siteStudio',
} as const;

export type ArtifactQuickHandoffDraftKind =
	keyof typeof ARTIFACT_QUICK_HANDOFF_LABEL_KEYS;

const QUICK_HANDOFF_ORDER: ArtifactQuickHandoffDraftKind[] = [
	'ewrp',
	'gaf-chat',
	'ewdesk',
	'site-studio',
];

export type ArtifactQuickHandoffAction = {
	integrationKey: string;
	draftKind: ArtifactQuickHandoffDraftKind;
	labelKey: string;
};

export function artifactSupportsQuickHandoff(
	artifact: ProfessionalArtifact
): boolean {
	return (
		artifact.source_type === 'realtor_property' && Boolean(artifact.source_id)
	);
}

export function resolveArtifactQuickHandoffActions(
	integrations: ProfessionalRuntimeIntegration[]
): ArtifactQuickHandoffAction[] {
	const byKind = new Map<ArtifactQuickHandoffDraftKind, string>();
	for (const integration of integrations) {
		if (!integration.is_enabled) continue;
		const draftKind = integrationKeyToPropertyDraftKind(
			integration.integration_key
		);
		if (!draftKind || !(draftKind in ARTIFACT_QUICK_HANDOFF_LABEL_KEYS)) {
			continue;
		}
		const kind = draftKind as ArtifactQuickHandoffDraftKind;
		if (!byKind.has(kind)) {
			byKind.set(kind, integration.integration_key);
		}
	}
	return QUICK_HANDOFF_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
		draftKind: kind,
		integrationKey: byKind.get(kind) ?? kind,
		labelKey: ARTIFACT_QUICK_HANDOFF_LABEL_KEYS[kind],
	}));
}

/** Resolve runtime integration_key for a server draft_kind (ewrp, site-studio, …). */
export function resolveIntegrationKeyForDraftKind(
	draftKind: string,
	integrations: ProfessionalRuntimeIntegration[]
): string | null {
	const normalized = draftKind.trim();
	if (!normalized) return null;
	for (const integration of integrations) {
		if (!integration.is_enabled) continue;
		const mapped = integrationKeyToPropertyDraftKind(
			integration.integration_key
		);
		if (mapped === normalized) {
			return integration.integration_key;
		}
	}
	return null;
}
