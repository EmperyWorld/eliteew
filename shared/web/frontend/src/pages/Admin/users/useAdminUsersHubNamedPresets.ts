/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Named filter presets for admin Users hub (load/save/delete + selection).
 *
 * Invariants:
 * - Applying a preset goes through injected `applyFilterSnapshot` (single write path).
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 * - `pages/Admin/adminUsersFilterPresets.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	addNamedAdminUsersPreset,
	deleteNamedAdminUsersPreset,
	loadNamedAdminUsersPresets,
	type AdminUsersFilterSnapshot,
	type AdminUsersNamedPreset,
} from '../adminUsersFilterPresets';

export type AdminUsersHubNamedPresets = {
	namedPresets: AdminUsersNamedPreset[];
	selectedPresetId: string;
	handlePresetSelect: (id: string) => void;
	handleDeleteNamedPreset: () => void;
	handleSaveNamedPreset: () => void;
	clearSelectedPresetId: () => void;
};

type UseAdminUsersHubNamedPresetsOptions = {
	currentFilterSnapshot: AdminUsersFilterSnapshot;
	debouncedSearch: string;
	applyFilterSnapshot: (raw: AdminUsersFilterSnapshot) => void;
};

export function useAdminUsersHubNamedPresets(
	options: UseAdminUsersHubNamedPresetsOptions
): AdminUsersHubNamedPresets {
	const { currentFilterSnapshot, debouncedSearch, applyFilterSnapshot } =
		options;
	const { t } = useTranslation('desktopUi');

	const [namedPresets, setNamedPresets] = React.useState(
		loadNamedAdminUsersPresets
	);
	const [selectedPresetId, setSelectedPresetId] = React.useState('');

	const handleSaveNamedPreset = React.useCallback((): void => {
		const name = window.prompt(t('adminUsersHub.hubActions.presetPrompt'), '');
		if (!name?.trim()) return;
		const next = addNamedAdminUsersPreset(name, {
			...currentFilterSnapshot,
			search: debouncedSearch,
		});
		setNamedPresets(next);
		const created = next[0];
		if (created) setSelectedPresetId(created.id);
		toast.success(
			t('adminUsersHub.hubActions.presetSaved', { name: name.trim() })
		);
	}, [currentFilterSnapshot, debouncedSearch, t]);

	const handleLoadNamedPreset = React.useCallback(
		(presetId: string): void => {
			if (!presetId) return;
			const preset = namedPresets.find((p) => p.id === presetId);
			if (!preset) return;
			applyFilterSnapshot(preset.filters);
			setSelectedPresetId(presetId);
			toast.success(
				t('adminUsersHub.hubActions.presetApplied', { name: preset.name })
			);
		},
		[namedPresets, applyFilterSnapshot, t]
	);

	const handlePresetSelect = React.useCallback(
		(id: string) => {
			setSelectedPresetId(id);
			if (id) handleLoadNamedPreset(id);
		},
		[handleLoadNamedPreset]
	);

	const handleDeleteNamedPreset = React.useCallback((): void => {
		if (!selectedPresetId) return;
		const preset = namedPresets.find((p) => p.id === selectedPresetId);
		const next = deleteNamedAdminUsersPreset(selectedPresetId);
		setNamedPresets(next);
		setSelectedPresetId('');
		toast.success(
			preset
				? t('adminUsersHub.hubActions.presetDeleted', { name: preset.name })
				: t('adminUsersHub.hubActions.presetDeletedGeneric')
		);
	}, [selectedPresetId, namedPresets, t]);

	const clearSelectedPresetId = React.useCallback(() => {
		setSelectedPresetId('');
	}, []);

	return {
		namedPresets,
		selectedPresetId,
		handlePresetSelect,
		handleDeleteNamedPreset,
		handleSaveNamedPreset,
		clearSelectedPresetId,
	};
}
