/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side task filtering/sorting for UGS Hub lists (search, status, category, provider).
 *
 * Invariants:
 * - Input JSON search index builds only when search query is non-empty.
 *
 * Related:
 * - useUgsHubFilterMetadata.ts, hooks/ugsHub/useUgsHubController.ts
 */

import { useMemo } from 'react';

import type {
	GenerationType,
	ProviderHealth,
	UGSTask,
} from '../../../hooks/api/useUgsDashboard';
import { ugsProviderDisplayLabel } from '../../../utils/ugsProviderDisplayLabel';
import type { UgsHubFilterMetadata } from './useUgsHubFilterMetadata';

interface UseUgsHubTaskFiltersArgs {
	tasks: UGSTask[];
	generationTypes: GenerationType[];
	providerHealth: ProviderHealth[];
	searchQuery: string;
	statusFilter: string;
	categoryFilter: string;
	providerFilter: string;
	humanizeTypeKey: (typeKey: string) => string;
	/** Prebuilt type/provider maps — avoids duplicate work when filtering multiple task lists. */
	metadata?: UgsHubFilterMetadata;
}

const sortTasksByDate = (list: UGSTask[]) =>
	[...list].sort((a, b) => {
		const getTime = (task: UGSTask) =>
			new Date(task.updated_at || task.created_at || 0).getTime();
		return getTime(b) - getTime(a);
	});

export function useUgsHubTaskFilters({
	tasks,
	generationTypes,
	providerHealth,
	searchQuery,
	statusFilter,
	categoryFilter,
	providerFilter,
	humanizeTypeKey,
	metadata,
}: UseUgsHubTaskFiltersArgs) {
	const categoryByType = useMemo(() => {
		if (metadata?.categoryByType) {
			return metadata.categoryByType;
		}
		const map = new Map<string, string>();
		generationTypes.forEach((type) => {
			const category = type.category?.toLowerCase() || 'default';
			map.set(type.type_key, category);
		});
		return map;
	}, [generationTypes, metadata]);

	const providerByType = useMemo(() => {
		if (metadata?.providerByType) {
			return metadata.providerByType;
		}
		const map = new Map<string, string>();
		generationTypes.forEach((type) => {
			if (type.provider) {
				map.set(type.type_key, type.provider);
			}
		});
		return map;
	}, [generationTypes, metadata]);

	const providerNameToDisplay = useMemo(() => {
		if (metadata?.providerNameToDisplay) {
			return metadata.providerNameToDisplay;
		}
		const m = new Map<string, string>();
		for (const p of providerHealth) {
			m.set(
				p.provider_name,
				ugsProviderDisplayLabel(p.display_label, undefined, p.provider_name)
			);
		}
		return m;
	}, [providerHealth, metadata]);

	const providerDisplayByType = useMemo(() => {
		if (metadata?.providerDisplayByType) {
			return metadata.providerDisplayByType;
		}
		const map = new Map<string, string>();
		generationTypes.forEach((type) => {
			if (type.provider) {
				map.set(
					type.type_key,
					providerNameToDisplay.get(type.provider) ??
						ugsProviderDisplayLabel(null, undefined, type.provider)
				);
			}
		});
		return map;
	}, [generationTypes, metadata, providerNameToDisplay]);

	const displayNameByType = useMemo(() => {
		if (metadata?.displayNameByType) {
			return metadata.displayNameByType;
		}
		const map = new Map<string, string>();
		generationTypes.forEach((type) => {
			if (type.display_name) {
				map.set(type.type_key, type.display_name);
			}
		});
		return map;
	}, [generationTypes, metadata]);

	const searchQueryLower = searchQuery.trim().toLowerCase();

	const taskInputSearchLowerById = useMemo(() => {
		if (!searchQueryLower) {
			return null;
		}
		const map = new Map<string, string>();
		for (const task of tasks) {
			try {
				map.set(task.id, JSON.stringify(task.input_data ?? {}).toLowerCase());
			} catch {
				map.set(task.id, '');
			}
		}
		return map;
	}, [tasks, searchQueryLower]);

	const filteredTasks = useMemo(() => {
		return tasks.filter((task) => {
			const displayName =
				displayNameByType.get(task.type_key) || humanizeTypeKey(task.type_key);
			const matchesSearch =
				searchQueryLower === '' ||
				displayName.toLowerCase().includes(searchQueryLower) ||
				(taskInputSearchLowerById?.get(task.id) ?? '').includes(
					searchQueryLower
				) ||
				task.id.toLowerCase().includes(searchQueryLower);

			const matchesStatus =
				statusFilter === 'all' || task.status === statusFilter;
			const category = categoryByType.get(task.type_key) || 'default';
			const matchesCategory =
				categoryFilter === 'all' || categoryFilter === category;
			const provider = providerByType.get(task.type_key) || 'unknown';
			const matchesProvider =
				providerFilter === 'all' || providerFilter === provider;

			return (
				matchesSearch && matchesStatus && matchesCategory && matchesProvider
			);
		});
	}, [
		tasks,
		searchQueryLower,
		statusFilter,
		categoryFilter,
		providerFilter,
		categoryByType,
		providerByType,
		displayNameByType,
		taskInputSearchLowerById,
		humanizeTypeKey,
	]);

	const filteredActiveTasks = useMemo(
		() =>
			filteredTasks.filter(
				(task) =>
					task.status === 'processing' ||
					task.status === 'pending' ||
					task.status === 'queued' ||
					task.status === 'retrying'
			),
		[filteredTasks]
	);

	const filteredHistoryTasks = useMemo(
		() =>
			filteredTasks.filter(
				(task) =>
					task.status === 'completed' ||
					task.status === 'failed' ||
					task.status === 'cancelled'
			),
		[filteredTasks]
	);

	const filteredCompletedTasks = useMemo(
		() => filteredTasks.filter((task) => task.status === 'completed'),
		[filteredTasks]
	);

	const filteredFailedTasks = useMemo(
		() => filteredTasks.filter((task) => task.status === 'failed'),
		[filteredTasks]
	);

	const sortedFilteredTasks = useMemo(
		() => sortTasksByDate(filteredTasks),
		[filteredTasks]
	);
	const sortedActiveFilteredTasks = useMemo(
		() => sortTasksByDate(filteredActiveTasks),
		[filteredActiveTasks]
	);
	const sortedHistoryTasks = useMemo(
		() => sortTasksByDate(filteredHistoryTasks),
		[filteredHistoryTasks]
	);
	const sortedCompletedTasks = useMemo(
		() => sortTasksByDate(filteredCompletedTasks),
		[filteredCompletedTasks]
	);
	const sortedFailedTasks = useMemo(
		() => sortTasksByDate(filteredFailedTasks),
		[filteredFailedTasks]
	);

	const availableCategories = useMemo(() => {
		const categories = new Set<string>();
		generationTypes.forEach((type) => {
			if (type.category) {
				categories.add(type.category.toLowerCase());
			}
		});
		filteredTasks.forEach((task) => {
			const category = categoryByType.get(task.type_key);
			if (category) {
				categories.add(category);
			}
		});
		return ['all', ...Array.from(categories)];
	}, [generationTypes, filteredTasks, categoryByType]);

	const availableProviders = useMemo(() => {
		const providers = new Set<string>();
		generationTypes.forEach((type) => {
			if (type.provider) {
				providers.add(type.provider);
			}
		});
		providerHealth.forEach((provider) => {
			if (provider.provider_name) {
				providers.add(provider.provider_name);
			}
		});
		filteredTasks.forEach((task) => {
			const provider = providerByType.get(task.type_key);
			if (provider) {
				providers.add(provider);
			}
		});
		return ['all', ...Array.from(providers)];
	}, [generationTypes, providerHealth, filteredTasks, providerByType]);

	const providerLabelMap = useMemo(() => {
		const r: Record<string, string> = {};
		const names = new Set<string>();
		generationTypes.forEach((type) => {
			if (type.provider) names.add(type.provider);
		});
		providerHealth.forEach((p) => {
			if (p.provider_name) names.add(p.provider_name);
		});
		filteredTasks.forEach((task) => {
			const pr = providerByType.get(task.type_key);
			if (pr) names.add(pr);
		});
		for (const name of names) {
			r[name] =
				providerNameToDisplay.get(name) ??
				ugsProviderDisplayLabel(null, undefined, name);
		}
		return r;
	}, [
		generationTypes,
		providerHealth,
		filteredTasks,
		providerByType,
		providerNameToDisplay,
	]);

	return {
		categoryByType,
		providerByType,
		providerDisplayByType,
		providerLabelMap,
		displayNameByType,
		filteredTasks,
		filteredActiveTasks,
		filteredHistoryTasks,
		filteredCompletedTasks,
		filteredFailedTasks,
		sortedFilteredTasks,
		sortedActiveFilteredTasks,
		sortedHistoryTasks,
		sortedCompletedTasks,
		sortedFailedTasks,
		availableCategories,
		availableProviders,
	};
}
