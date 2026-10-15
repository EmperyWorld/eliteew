/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Window layout preset actions for desktop expansion settings.
 *
 * Related:
 * - useDesktopExpansionSettings.ts
 */

import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
	curatedLayoutZones,
	type CuratedWorkspaceLayoutTemplateId,
	type SnapZoneConcrete,
} from '../../constants/desktopCuratedWorkspaceLayoutTemplates';
import {
	type DesktopScenarioWindowLayoutId,
	scenarioGeometryTemplate,
} from '../../constants/desktopScenarioWindowLayouts';
import type {
	PersistedWindowState,
	WindowState,
} from '../../types/desktop.types';
import type { DesktopWindowLayoutPreset } from '../../types/desktopExpansion.types';
import { getRectForSnapZone } from '../../utils/desktopSnapGeometry';
import { layoutWorkSizeFromDom, persistableWindow } from './layoutHelpers';
import { createId } from './normalizers';
import type { DesktopExpansionShellCore } from './useDesktopExpansionShellCore';

type WindowLayoutActionsDeps = Pick<
	DesktopExpansionShellCore,
	'windowLayoutPresets' | 'setWindowLayoutPresets' | 'patchExpansion'
> & {
	currentDesktopWindows: WindowState[];
	activeDesktopId: string;
	onApplyWindowLayoutPreset?: (preset: DesktopWindowLayoutPreset) => void;
	onCollectCurrentWorkspaceWindows?: () => void;
	onApplyCuratedWorkspaceLayout?: (
		templateId: CuratedWorkspaceLayoutTemplateId
	) => void;
	t: TFunction<'desktopUi'>;
};

export function useDesktopExpansionWindowLayoutActions(
	deps: WindowLayoutActionsDeps
) {
	const {
		windowLayoutPresets,
		setWindowLayoutPresets,
		patchExpansion,
		currentDesktopWindows,
		activeDesktopId,
		onApplyWindowLayoutPreset,
		onCollectCurrentWorkspaceWindows,
		onApplyCuratedWorkspaceLayout,
		t,
	} = deps;

	const addWindowLayoutPreset = useCallback(async () => {
		const windows = currentDesktopWindows.map((w) =>
			persistableWindow(w, activeDesktopId)
		);
		const next = [
			...windowLayoutPresets,
			{
				id: createId('layout'),
				name: t('settingsPanel.expansionLayoutNewName', {
					count: windowLayoutPresets.length + 1,
				}),
				description: t('settingsPanel.expansionLayoutNewDesc'),
				windows,
				createdAt: new Date().toISOString(),
			},
		].slice(-24);
		setWindowLayoutPresets(next);
		await patchExpansion({ window_layout_presets: next });
	}, [
		activeDesktopId,
		currentDesktopWindows,
		patchExpansion,
		setWindowLayoutPresets,
		t,
		windowLayoutPresets,
	]);

	const persistSnapGeometryPreset = useCallback(
		async (
			zones: readonly SnapZoneConcrete[],
			presetName: string,
			presetDescription: string
		) => {
			if (zones.length === 0) return;
			const ordered = [...currentDesktopWindows]
				.filter((w) => !w.isMinimized)
				.sort((a, b) => b.zIndex - a.zIndex);
			if (ordered.length === 0) {
				toast.info(t('settingsPanel.expansionCuratedLayoutNoWindows'));
				return;
			}
			const work = layoutWorkSizeFromDom();
			const limit = Math.min(ordered.length, zones.length);
			const windowsSnap: PersistedWindowState[] = [];
			for (let i = 0; i < limit; i++) {
				const win = ordered[i];
				const zn = zones[i];
				const layout = getRectForSnapZone(zn, work);
				const base = persistableWindow(win, activeDesktopId);
				windowsSnap.push({
					...base,
					position: layout.position,
					size: layout.size,
					isMaximized: layout.isMaximized,
					isMinimized: false,
				});
			}
			const next = [
				...windowLayoutPresets,
				{
					id: createId('layout'),
					name: presetName,
					description: presetDescription,
					windows: windowsSnap,
					createdAt: new Date().toISOString(),
				},
			].slice(-24);
			setWindowLayoutPresets(next);
			await patchExpansion({ window_layout_presets: next });
		},
		[
			activeDesktopId,
			currentDesktopWindows,
			patchExpansion,
			setWindowLayoutPresets,
			t,
			windowLayoutPresets,
		]
	);

	const addWindowLayoutPresetFromCuratedTemplate = useCallback(
		async (templateId: CuratedWorkspaceLayoutTemplateId) => {
			const zones = curatedLayoutZones(templateId);
			await persistSnapGeometryPreset(
				zones,
				t(`settingsPanel.expansionCuratedLayout.${templateId}.presetName`),
				t(`settingsPanel.expansionCuratedLayout.${templateId}.presetDesc`)
			);
		},
		[persistSnapGeometryPreset, t]
	);

	const addWindowLayoutPresetFromScenario = useCallback(
		async (scenarioId: DesktopScenarioWindowLayoutId) => {
			const geom = scenarioGeometryTemplate(scenarioId);
			const zones = curatedLayoutZones(geom);
			await persistSnapGeometryPreset(
				zones,
				t(`settingsPanel.expansionLayoutScenario.${scenarioId}.presetName`),
				t(`settingsPanel.expansionLayoutScenario.${scenarioId}.presetDesc`)
			);
		},
		[persistSnapGeometryPreset, t]
	);

	const applyScenarioWorkspaceLayout = useCallback(
		(scenarioId: DesktopScenarioWindowLayoutId) => {
			const geom = scenarioGeometryTemplate(scenarioId);
			onApplyCuratedWorkspaceLayout?.(geom);
		},
		[onApplyCuratedWorkspaceLayout]
	);

	const removeWindowLayoutPreset = useCallback(
		async (presetId: string) => {
			const next = windowLayoutPresets.filter(
				(preset) => preset.id !== presetId
			);
			setWindowLayoutPresets(next);
			await patchExpansion({ window_layout_presets: next });
		},
		[patchExpansion, setWindowLayoutPresets, windowLayoutPresets]
	);

	const applyWindowLayoutPreset = useCallback(
		(presetId: string) => {
			const preset = windowLayoutPresets.find((item) => item.id === presetId);
			if (preset) {
				onApplyWindowLayoutPreset?.(preset);
			}
		},
		[onApplyWindowLayoutPreset, windowLayoutPresets]
	);

	const collectCurrentWorkspaceWindows = useCallback(() => {
		onCollectCurrentWorkspaceWindows?.();
	}, [onCollectCurrentWorkspaceWindows]);

	const applyCuratedWorkspaceLayout = useCallback(
		(templateId: CuratedWorkspaceLayoutTemplateId) => {
			onApplyCuratedWorkspaceLayout?.(templateId);
		},
		[onApplyCuratedWorkspaceLayout]
	);

	return {
		addWindowLayoutPreset,
		addWindowLayoutPresetFromCuratedTemplate,
		addWindowLayoutPresetFromScenario,
		removeWindowLayoutPreset,
		applyWindowLayoutPreset,
		applyCuratedWorkspaceLayout,
		applyScenarioWorkspaceLayout,
		collectCurrentWorkspaceWindows,
	};
}
