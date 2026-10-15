/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User «Мои фразы» CRUD, reorder, duplicate, icon overrides, JSON import/export handlers (U8.1 extract).
 *
 * Invariants:
 * - Built-in quick presets are never deleted/renamed via this controller.
 * - Icon overrides stay in localStorage per principal.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionOutputSurface/CompanionMyPhrasesMode.tsx
 */

import type { TFunction } from 'i18next';
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import {
	buildDuplicateQuickPresetLabel,
	buildQuickPresetReorderUpdates,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesUi';
import {
	companionMyPhraseImportFingerprint,
	filterCompanionMyPhrasesImportCreates,
	parseCompanionMyPhrasesImportJson,
	type CompanionMyPhrasesImportError,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesImport';
import {
	readMyPhraseIconOverrides,
	writeMyPhraseIconOverride,
	type MyPhraseIconOverride,
} from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import type { CompanionQuickPresetLabelDialogState } from '@/features/ewa/companionQuickPresetDialogTypes';
import {
	buildBuiltinCompanionQuickPresets,
	isCompanionQuickPresetDeletable,
	isCompanionQuickPresetRenamable,
	mergeCompanionQuickPresets,
	type CompanionQuickPresetChip,
} from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	createEwaCompanionQuickPreset,
	deleteEwaCompanionQuickPreset,
	isEwaCompanionBuiltinQuickPresetId,
	listEwaCompanionQuickPresets,
	patchEwaCompanionQuickPreset,
} from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionMyPhrasesControllerOptions = {
	principalId: string;
	draft: string;
	pending: boolean;
	notifyError: (message: string) => void;
	notifySuccess: (title: string, message?: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionMyPhrasesController({
	principalId,
	draft,
	pending,
	notifyError,
	notifySuccess,
	t,
}: UseCompanionMyPhrasesControllerOptions) {
	const [savingQuickPreset, setSavingQuickPreset] = useState(false);
	const [deletingQuickPresetId, setDeletingQuickPresetId] = useState<
		string | null
	>(null);
	const [renamingQuickPresetId, setRenamingQuickPresetId] = useState<
		string | null
	>(null);
	const [reorderingMyPhrases, setReorderingMyPhrases] = useState(false);
	const [phraseIconOverrides, setPhraseIconOverrides] = useState(() =>
		readMyPhraseIconOverrides(principalId)
	);
	const [baseQuickPresets, setBaseQuickPresets] = useState<
		CompanionQuickPresetChip[]
	>(() => buildBuiltinCompanionQuickPresets(t));
	const [quickPresetLabelDialog, setQuickPresetLabelDialog] =
		useState<CompanionQuickPresetLabelDialogState | null>(null);
	const [quickPresetDeleteTarget, setQuickPresetDeleteTarget] =
		useState<CompanionQuickPresetChip | null>(null);
	const quickPresetLabelInputRef = useRef<HTMLInputElement | null>(null);

	const reloadUserQuickPresetsFromServer = useCallback(async () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		try {
			const server = await listEwaCompanionQuickPresets({
				scopePrincipalId: principalId,
			});
			setBaseQuickPresets(mergeCompanionQuickPresets(server, builtins));
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_quick_presets_load',
				'server quick presets load failed; using builtins',
				err
			);
			setBaseQuickPresets(builtins);
		}
	}, [principalId, t]);

	useEffect(() => {
		setPhraseIconOverrides(readMyPhraseIconOverrides(principalId));
	}, [principalId]);

	useEffect(() => {
		void reloadUserQuickPresetsFromServer();
	}, [reloadUserQuickPresetsFromServer]);

	const quickPresetLabelDialogOpen = quickPresetLabelDialog !== null;

	useEffect(() => {
		if (!quickPresetLabelDialogOpen) return;
		queueMicrotask(() => quickPresetLabelInputRef.current?.focus());
	}, [quickPresetLabelDialogOpen]);

	const myPhrasesBusy = useMemo(
		() =>
			savingQuickPreset ||
			reorderingMyPhrases ||
			Boolean(deletingQuickPresetId) ||
			Boolean(renamingQuickPresetId),
		[
			deletingQuickPresetId,
			renamingQuickPresetId,
			reorderingMyPhrases,
			savingQuickPreset,
		]
	);

	const myPhrasesImportErrorMessage = useCallback(
		(code: CompanionMyPhrasesImportError) => {
			switch (code) {
				case 'invalid_json':
					return t('ewaCompanion.myPhrases.importInvalidJson');
				case 'invalid_format':
					return t('ewaCompanion.myPhrases.importInvalidFormat');
				case 'unsupported_version':
					return t('ewaCompanion.myPhrases.importUnsupportedVersion');
				case 'empty':
					return t('ewaCompanion.myPhrases.importEmpty');
				case 'too_many':
					return t('ewaCompanion.myPhrases.importTooMany');
				case 'invalid_phrase':
					return t('ewaCompanion.myPhrases.importInvalidPhrase');
				default:
					return t('ewaCompanion.myPhrases.importFailed');
			}
		},
		[t]
	);

	const handleSaveQuickPreset = useCallback(() => {
		const promptText = draft.trim();
		if (!promptText || pending || savingQuickPreset) return;
		const defaultLabel =
			promptText.length > 42 ? `${promptText.slice(0, 39)}…` : promptText;
		setQuickPresetLabelDialog({
			mode: 'save',
			value: defaultLabel,
			promptText,
		});
	}, [draft, pending, savingQuickPreset]);

	const handleDeleteQuickPreset = useCallback(
		(preset: CompanionQuickPresetChip) => {
			if (
				!isCompanionQuickPresetDeletable(preset) ||
				isEwaCompanionBuiltinQuickPresetId(preset.id) ||
				pending ||
				deletingQuickPresetId
			) {
				return;
			}
			setQuickPresetDeleteTarget(preset);
		},
		[deletingQuickPresetId, pending]
	);

	const handleQuickPresetDeleteConfirm = useCallback(async () => {
		const preset = quickPresetDeleteTarget;
		if (!preset) return;
		setQuickPresetDeleteTarget(null);
		setDeletingQuickPresetId(preset.id);
		try {
			await deleteEwaCompanionQuickPreset(preset.id);
			await reloadUserQuickPresetsFromServer();
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_quick_preset_delete',
				'quick preset delete failed',
				err
			);
			notifyError(t('ewaCompanion.quickPresetDeleteFailed'));
		} finally {
			setDeletingQuickPresetId(null);
		}
	}, [
		notifyError,
		quickPresetDeleteTarget,
		reloadUserQuickPresetsFromServer,
		t,
	]);

	const handleRenameQuickPreset = useCallback(
		(preset: CompanionQuickPresetChip) => {
			if (
				!isCompanionQuickPresetRenamable(preset) ||
				isEwaCompanionBuiltinQuickPresetId(preset.id) ||
				pending ||
				renamingQuickPresetId ||
				deletingQuickPresetId
			) {
				return;
			}
			setQuickPresetLabelDialog({
				mode: 'rename',
				value: preset.label,
				presetId: preset.id,
				previousLabel: preset.label,
			});
		},
		[deletingQuickPresetId, pending, renamingQuickPresetId]
	);

	const closeQuickPresetLabelDialog = useCallback(() => {
		setQuickPresetLabelDialog(null);
	}, []);

	const handleQuickPresetLabelDialogConfirm = useCallback(async () => {
		const dialog = quickPresetLabelDialog;
		const label = dialog?.value.trim() ?? '';
		if (!dialog || !label) return;
		setQuickPresetLabelDialog(null);
		if (dialog.mode === 'save') {
			setSavingQuickPreset(true);
			try {
				await createEwaCompanionQuickPreset({
					label,
					prompt_text: dialog.promptText,
					sort_order: 100,
				});
				await reloadUserQuickPresetsFromServer();
				notifySuccess(t('ewaCompanion.userToast.phraseSavedTitle'), label);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_quick_preset_save',
					'quick preset save failed',
					err
				);
				notifyError(t('ewaCompanion.quickPresetSaveFailed'));
			} finally {
				setSavingQuickPreset(false);
			}
			return;
		}
		if (label === dialog.previousLabel) return;
		setRenamingQuickPresetId(dialog.presetId);
		try {
			await patchEwaCompanionQuickPreset(dialog.presetId, { label });
			await reloadUserQuickPresetsFromServer();
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_quick_preset_rename',
				'quick preset rename failed',
				err
			);
			notifyError(t('ewaCompanion.quickPresetRenameFailed'));
		} finally {
			setRenamingQuickPresetId(null);
		}
	}, [
		notifyError,
		notifySuccess,
		quickPresetLabelDialog,
		reloadUserQuickPresetsFromServer,
		t,
	]);

	const handleDuplicateMyPhrase = useCallback(
		async (preset: CompanionQuickPresetChip) => {
			if (
				!isCompanionQuickPresetDeletable(preset) ||
				isEwaCompanionBuiltinQuickPresetId(preset.id) ||
				pending ||
				myPhrasesBusy
			) {
				return;
			}
			setSavingQuickPreset(true);
			try {
				const label = buildDuplicateQuickPresetLabel(
					preset.label,
					t('ewaCompanion.myPhrases.duplicateLabelSuffix')
				);
				await createEwaCompanionQuickPreset({
					label,
					prompt_text: preset.promptText,
					sort_order: preset.sortOrder + 5,
				});
				await reloadUserQuickPresetsFromServer();
				notifySuccess(t('ewaCompanion.userToast.phraseDuplicatedTitle'), label);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_quick_preset_duplicate',
					'quick preset duplicate failed',
					err
				);
				notifyError(t('ewaCompanion.myPhrases.duplicateFailed'));
			} finally {
				setSavingQuickPreset(false);
			}
		},
		[
			myPhrasesBusy,
			notifyError,
			notifySuccess,
			pending,
			reloadUserQuickPresetsFromServer,
			t,
		]
	);

	const handleReorderMyPhrases = useCallback(
		async (ordered: CompanionQuickPresetChip[]) => {
			if (pending || reorderingMyPhrases) return;
			const userIds = ordered
				.filter(isCompanionQuickPresetDeletable)
				.map((row) => row.id);
			if (userIds.length < 2) return;
			setReorderingMyPhrases(true);
			try {
				const updates = buildQuickPresetReorderUpdates(userIds);
				await Promise.all(
					updates.map((row) =>
						patchEwaCompanionQuickPreset(row.id, {
							sort_order: row.sort_order,
						})
					)
				);
				await reloadUserQuickPresetsFromServer();
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_quick_preset_reorder',
					'quick preset reorder failed',
					err
				);
				notifyError(t('ewaCompanion.myPhrases.reorderFailed'));
			} finally {
				setReorderingMyPhrases(false);
			}
		},
		[
			notifyError,
			pending,
			reorderingMyPhrases,
			reloadUserQuickPresetsFromServer,
			t,
		]
	);

	const handleMyPhraseIconChange = useCallback(
		(presetId: string, visual: MyPhraseIconOverride) => {
			setPhraseIconOverrides(
				writeMyPhraseIconOverride(principalId, presetId, visual)
			);
		},
		[principalId]
	);

	const handleMyPhrasesExportSuccess = useCallback(() => {
		notifySuccess(t('ewaCompanion.myPhrases.exportDone'));
	}, [notifySuccess, t]);

	const handleMyPhrasesExportFailed = useCallback(() => {
		notifyError(t('ewaCompanion.myPhrases.exportFailed'));
	}, [notifyError, t]);

	const handleImportMyPhrasesFile = useCallback(
		async (file: File) => {
			if (pending || myPhrasesBusy) return;
			let text = '';
			try {
				text = await file.text();
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_my_phrases_import_read',
					'import file read failed',
					err
				);
				notifyError(t('ewaCompanion.myPhrases.importReadFailed'));
				return;
			}
			const parsed = parseCompanionMyPhrasesImportJson(text);
			if (!parsed.ok) {
				notifyError(myPhrasesImportErrorMessage(parsed.error));
				return;
			}
			const existingFingerprints = new Set(
				baseQuickPresets
					.filter(isCompanionQuickPresetDeletable)
					.map((row) =>
						companionMyPhraseImportFingerprint(row.label, row.promptText)
					)
			);
			const { toCreate, skipped } = filterCompanionMyPhrasesImportCreates(
				parsed.phrases,
				existingFingerprints
			);
			if (toCreate.length === 0) {
				notifyError(t('ewaCompanion.myPhrases.importNothingNew'));
				return;
			}
			setSavingQuickPreset(true);
			let imported = 0;
			try {
				for (const row of toCreate) {
					const created = await createEwaCompanionQuickPreset({
						label: row.label,
						prompt_text: row.prompt_text,
						sort_order: row.sort_order,
					});
					if (row.icon) {
						setPhraseIconOverrides(
							writeMyPhraseIconOverride(principalId, created.id, row.icon)
						);
					}
					imported += 1;
				}
				await reloadUserQuickPresetsFromServer();
				if (skipped > 0) {
					notifySuccess(
						t('ewaCompanion.myPhrases.importDoneWithSkips', {
							imported,
							skipped,
						})
					);
				} else {
					notifySuccess(
						t('ewaCompanion.myPhrases.importDone', {
							imported,
						})
					);
				}
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_my_phrases_import',
					'my phrases import failed',
					err
				);
				if (imported > 0) {
					await reloadUserQuickPresetsFromServer();
					notifyError(
						t('ewaCompanion.myPhrases.importPartialFailed', {
							imported,
						})
					);
				} else {
					notifyError(t('ewaCompanion.myPhrases.importFailed'));
				}
			} finally {
				setSavingQuickPreset(false);
			}
		},
		[
			baseQuickPresets,
			myPhrasesBusy,
			myPhrasesImportErrorMessage,
			notifyError,
			notifySuccess,
			pending,
			principalId,
			reloadUserQuickPresetsFromServer,
			t,
		]
	);

	return {
		baseQuickPresets,
		phraseIconOverrides,
		myPhrasesBusy,
		savingQuickPreset,
		deletingQuickPresetId,
		renamingQuickPresetId,
		quickPresetLabelDialog,
		setQuickPresetLabelDialog,
		quickPresetDeleteTarget,
		setQuickPresetDeleteTarget,
		quickPresetLabelInputRef:
			quickPresetLabelInputRef as RefObject<HTMLInputElement | null>,
		handleSaveQuickPreset,
		handleDeleteQuickPreset,
		handleQuickPresetDeleteConfirm,
		handleRenameQuickPreset,
		closeQuickPresetLabelDialog,
		handleQuickPresetLabelDialogConfirm,
		handleDuplicateMyPhrase,
		handleReorderMyPhrases,
		handleMyPhraseIconChange,
		handleMyPhrasesExportSuccess,
		handleMyPhrasesExportFailed,
		handleImportMyPhrasesFile,
	};
}
