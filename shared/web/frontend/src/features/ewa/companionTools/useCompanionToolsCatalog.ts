/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tools catalog open state, pin/recent storage, and quick chip apply handlers (U8.1 extract).
 *
 * Invariants:
 * - Built-in OCR chip opens OCR source dialog instead of submitting prompt text.
 * - Recent tool ids are capped in localStorage per principal.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';

import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { isCompanionImageOcrToolChip } from '@/features/ewa/companionTools/companionImageOcrToolId';
import { readPinnedToolIds } from '@/features/ewa/companionTools/companionPinnedToolsStorage';
import {
	readRecentToolIds,
	recordRecentToolId,
} from '@/features/ewa/companionTools/companionRecentToolsStorage';
import { mergeCompanionRecentToolChipIds } from '@/features/ewa/companionTools/companionRecentToolsMerge';

export type UseCompanionToolsCatalogOptions = {
	principalId: string;
	learnedPreferences: unknown;
	pending: boolean;
	ocrBusy: boolean;
	updateDraft: (text: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	submitLineRef: RefObject<(text: string) => void | Promise<void>>;
	onOpenOcrSource: () => void;
	/** Unified Workspace: open in-companion music wizard for XL Base chip. */
	onOpenMusicWizard?: () => void;
};

function chipBuiltinKey(chipId: string): string {
	const id = chipId.trim();
	const prefix = 'ewa_companion_builtin_quick_preset:';
	if (id.startsWith(prefix)) return id.slice(prefix.length);
	if (id.includes(':')) return id.split(':').pop() ?? id;
	return id;
}

export function useCompanionToolsCatalog({
	principalId,
	learnedPreferences,
	pending,
	ocrBusy,
	updateDraft,
	inputRef,
	submitLineRef,
	onOpenOcrSource,
	onOpenMusicWizard,
}: UseCompanionToolsCatalogOptions) {
	const [toolsCatalogOpen, setToolsCatalogOpen] = useState(false);
	const [pinnedToolIds, setPinnedToolIds] = useState<string[]>(() =>
		readPinnedToolIds(principalId)
	);
	const [recentToolIds, setRecentToolIds] = useState<string[]>(() =>
		readRecentToolIds(principalId)
	);

	useEffect(() => {
		if (!toolsCatalogOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setToolsCatalogOpen(false);
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [toolsCatalogOpen]);

	useEffect(() => {
		setPinnedToolIds(readPinnedToolIds(principalId));
		setRecentToolIds(readRecentToolIds(principalId));
	}, [principalId]);

	const catalogRecentToolIds = useMemo(
		() =>
			mergeCompanionRecentToolChipIds({
				localRecent: recentToolIds,
				learnedPreferences,
			}),
		[learnedPreferences, recentToolIds]
	);

	const applyQuickPreset = useCallback(
		(preset: CompanionQuickPresetChip) => {
			const next = preset.promptText.trim();
			if (!next || pending) return;
			setRecentToolIds(recordRecentToolId(principalId, preset.id));
			if (preset.builtin) {
				void submitLineRef.current?.(next);
				return;
			}
			updateDraft(next);
			queueMicrotask(() => inputRef.current?.focus());
		},
		[inputRef, pending, principalId, submitLineRef, updateDraft]
	);

	const insertToolIntoComposer = useCallback(
		(preset: CompanionQuickPresetChip) => {
			const next = preset.promptText.trim();
			if (!next || pending) return;
			setRecentToolIds(recordRecentToolId(principalId, preset.id));
			updateDraft(next);
			queueMicrotask(() => inputRef.current?.focus());
		},
		[inputRef, pending, principalId, updateDraft]
	);

	const handleTryTool = useCallback(
		(chip: CompanionQuickPresetChip) => {
			if (isCompanionImageOcrToolChip(chip.id)) {
				if (pending || ocrBusy) return;
				setToolsCatalogOpen(false);
				setRecentToolIds(recordRecentToolId(principalId, chip.id));
				onOpenOcrSource();
				return;
			}
			const key = chipBuiltinKey(chip.id);
			if (key === 'xlBaseInteractive' && onOpenMusicWizard) {
				if (pending) return;
				setToolsCatalogOpen(false);
				setRecentToolIds(recordRecentToolId(principalId, chip.id));
				onOpenMusicWizard();
				return;
			}
			if ((key === 'documentList' || key === 'documentOpen') && !pending) {
				setToolsCatalogOpen(false);
				setRecentToolIds(recordRecentToolId(principalId, chip.id));
				applyQuickPreset(chip);
				return;
			}
			applyQuickPreset(chip);
		},
		[
			applyQuickPreset,
			ocrBusy,
			onOpenMusicWizard,
			onOpenOcrSource,
			pending,
			principalId,
		]
	);

	const handleInsertTool = useCallback(
		(chip: CompanionQuickPresetChip) => {
			if (pending || ocrBusy) return;
			insertToolIntoComposer(chip);
		},
		[insertToolIntoComposer, ocrBusy, pending]
	);

	return {
		toolsCatalogOpen,
		setToolsCatalogOpen,
		pinnedToolIds,
		setPinnedToolIds,
		recentToolIds,
		setRecentToolIds,
		catalogRecentToolIds,
		applyQuickPreset,
		handleTryTool,
		handleInsertTool,
	};
}
