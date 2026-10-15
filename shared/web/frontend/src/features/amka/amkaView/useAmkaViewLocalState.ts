/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local UI state for AmkaView: tabs, run form, skip toggles, pager index, preferRunIdRef.
 *
 * Invariants:
 * - preferRunIdRef stickiness stays owned here with selection effects in useAmkaViewSelectionEffects.
 *
 * Related:
 * - useAmkaViewSelectionEffects.ts, useAmkaViewCompose.ts
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AMKA_START_SECTION_KEYS } from '@/services/amka/marketingCabinetAmkaBridge';

import type {
	AmkaImcFocus,
	AmkaMainTab,
	AmkaRunMode,
} from '@/features/amka/amkaView/amkaViewTypes';

export function useAmkaViewLocalState(canEditAmkaOperatorConfig: boolean) {
	const { t } = useTranslation('marketing');
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	/** Keeps freshly started run selected until it appears in the runs list query. */
	const preferRunIdRef = useRef<string | null>(null);
	const [userInstruction, setUserInstruction] = useState('');
	const [skipSectionKeys, setSkipSectionKeys] = useState<
		Record<string, boolean>
	>({});
	const [skipOperationKeys, setSkipOperationKeys] = useState<
		Record<string, boolean>
	>({});
	const [skipStepIds, setSkipStepIds] = useState<Record<string, boolean>>({});
	const [stepPageIndex, setStepPageIndex] = useState(0);
	const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>(
		() => {
			const initial: Record<string, boolean> = {};
			for (const k of AMKA_START_SECTION_KEYS) initial[k] = true;
			return initial;
		}
	);
	const [imcTypeKey, setImcTypeKey] = useState('');
	const [imcFocus, setImcFocus] = useState<AmkaImcFocus>('mixed');
	const [imcMaxWait, setImcMaxWait] = useState('');
	const [runMode, setRunMode] = useState<AmkaRunMode>('auto');
	const [autoCycleCount, setAutoCycleCount] = useState(1);
	const [exportIncludeCoreAlignment, setExportIncludeCoreAlignment] =
		useState(false);
	const [perStepExecution, setPerStepExecution] = useState(false);
	const [startPresetId, setStartPresetId] = useState('');
	const [mainTab, setMainTab] = useState<AmkaMainTab>('run');
	const [builderGlobalDirty, setBuilderGlobalDirty] = useState(false);

	const handleMainTabChange = (tab: AmkaMainTab) => {
		if (
			tab === 'run' &&
			mainTab === 'builder' &&
			builderGlobalDirty &&
			canEditAmkaOperatorConfig
		) {
			if (
				typeof globalThis.confirm === 'function' &&
				!globalThis.confirm(t('amkaBuilder.leaveUnsavedGlobal'))
			) {
				return;
			}
		}
		setMainTab(tab);
	};

	useEffect(() => {
		if (runMode === 'auto') {
			setPerStepExecution(false);
		}
	}, [runMode]);

	// Reset server-export option when the operator switches runs (alignment is per-run).
	useEffect(() => {
		void selectedRunId;
		setExportIncludeCoreAlignment(false);
		setSkipSectionKeys({});
		setSkipOperationKeys({});
		setSkipStepIds({});
	}, [selectedRunId]);

	useEffect(() => {
		setStartPresetId('');
	}, []);

	return {
		selectedRunId,
		setSelectedRunId,
		preferRunIdRef,
		userInstruction,
		setUserInstruction,
		skipSectionKeys,
		setSkipSectionKeys,
		skipOperationKeys,
		setSkipOperationKeys,
		skipStepIds,
		setSkipStepIds,
		stepPageIndex,
		setStepPageIndex,
		sectionToggles,
		setSectionToggles,
		imcTypeKey,
		setImcTypeKey,
		imcFocus,
		setImcFocus,
		imcMaxWait,
		setImcMaxWait,
		runMode,
		setRunMode,
		autoCycleCount,
		setAutoCycleCount,
		exportIncludeCoreAlignment,
		setExportIncludeCoreAlignment,
		perStepExecution,
		setPerStepExecution,
		startPresetId,
		setStartPresetId,
		mainTab,
		setMainTab,
		builderGlobalDirty,
		setBuilderGlobalDirty,
		handleMainTabChange,
	};
}
