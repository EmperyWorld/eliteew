/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared generation-type / provider maps for UGS Hub task filters (built once per catalog refresh).
 *
 * Related:
 * - useUgsHubTaskFilters.ts, hooks/ugsHub/useUgsHubController.ts
 */

import { useMemo } from 'react';

import type {
	GenerationType,
	ProviderHealth,
} from '../../../hooks/api/useUgsDashboard';
import { ugsProviderDisplayLabel } from '../../../utils/ugsProviderDisplayLabel';

export type UgsHubFilterMetadata = {
	categoryByType: Map<string, string>;
	providerByType: Map<string, string>;
	providerDisplayByType: Map<string, string>;
	displayNameByType: Map<string, string>;
	providerNameToDisplay: Map<string, string>;
};

export function useUgsHubFilterMetadata(
	generationTypes: GenerationType[],
	providerHealth: ProviderHealth[]
): UgsHubFilterMetadata {
	const providerNameToDisplay = useMemo(() => {
		const m = new Map<string, string>();
		for (const p of providerHealth) {
			m.set(
				p.provider_name,
				ugsProviderDisplayLabel(p.display_label, undefined, p.provider_name)
			);
		}
		return m;
	}, [providerHealth]);

	return useMemo(() => {
		const categoryByType = new Map<string, string>();
		const providerByType = new Map<string, string>();
		const providerDisplayByType = new Map<string, string>();
		const displayNameByType = new Map<string, string>();

		for (const type of generationTypes) {
			categoryByType.set(
				type.type_key,
				type.category?.toLowerCase() || 'default'
			);
			if (type.provider) {
				providerByType.set(type.type_key, type.provider);
				providerDisplayByType.set(
					type.type_key,
					providerNameToDisplay.get(type.provider) ??
						ugsProviderDisplayLabel(null, undefined, type.provider)
				);
			}
			if (type.display_name) {
				displayNameByType.set(type.type_key, type.display_name);
			}
		}

		return {
			categoryByType,
			providerByType,
			providerDisplayByType,
			displayNameByType,
			providerNameToDisplay,
		};
	}, [generationTypes, providerNameToDisplay]);
}
