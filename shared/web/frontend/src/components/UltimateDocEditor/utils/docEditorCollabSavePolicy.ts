/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Политика canonical save при live collaboration (Yjs step B): кто может autosave PUT в БД.
 *
 * Invariants:
 * - В активной коллабе Yjs — источник правды для текста; PUT — редкий flush владельца или ручной «Зафиксировать».
 * - Чистые функции без React/store.
 *
 * Related:
 * - `hooks/useDocEditorAutosave.ts`, `ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md`
 */

import {
	DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS,
	DOC_EDITOR_COLLAB_IDLE_CANONICAL_MS,
} from './docEditorPersistTiming';

/** Режим записи canonical документа во время/вне коллаба. */
export type DocEditorCollabSaveMode =
	| 'normal'
	| 'owner_idle_put'
	| 'manual_only'
	| 'yjs_only';

export interface ResolveDocEditorCollabSaveModeInput {
	collaborationActive: boolean;
	isDocumentOwner: boolean;
	canPersistCanonical: boolean;
}

export function resolveDocEditorCollabSaveMode(
	input: ResolveDocEditorCollabSaveModeInput
): DocEditorCollabSaveMode {
	const { collaborationActive, isDocumentOwner, canPersistCanonical } = input;
	if (!collaborationActive) {
		return 'normal';
	}
	if (isDocumentOwner && canPersistCanonical) {
		return 'owner_idle_put';
	}
	if (canPersistCanonical) {
		return 'manual_only';
	}
	return 'yjs_only';
}

/** Autosave PUT в БД разрешён (с учётом debounce режима). */
export function shouldRunAutosaveCanonicalPut(
	mode: DocEditorCollabSaveMode,
	options?: { forceOwnerFlush?: boolean }
): boolean {
	if (options?.forceOwnerFlush) {
		return mode === 'owner_idle_put' || mode === 'normal';
	}
	return mode === 'normal' || mode === 'owner_idle_put';
}

export function autosaveDebounceMsForMode(
	mode: DocEditorCollabSaveMode
): number {
	if (mode === 'owner_idle_put') {
		return DOC_EDITOR_COLLAB_IDLE_CANONICAL_MS;
	}
	return DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS;
}

/** Ключ i18n для tooltip кнопки save в шапке. */
export function saveActionTooltipKeyForMode(
	mode: DocEditorCollabSaveMode
): 'header.save.tooltip' | 'header.save.tooltipCollabCommit' {
	if (mode === 'manual_only') {
		return 'header.save.tooltipCollabCommit';
	}
	return 'header.save.tooltip';
}
