/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced autosave (unified content + doc editor PUT) и fallback-таймер; единая функция save для обеих веток.
 *
 * Invariants:
 * - Автосохранение не блокирует редактирование при ошибке сети.
 * - Version lock только вне live collaboration.
 * - В live collab autosave PUT — только владелец после idle (см. `docEditorCollabSavePolicy.ts`).
 *
 * Related:
 * - `useDocEditorCanonicalSave.ts`, `UltimateDocEditorInner.tsx`
 */

import { debounce } from '../../../hooks/useDebounce';
import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import type { StoreApi } from 'zustand';
import type { EditorStore } from '../store/editorStore';
import {
	autosaveDebounceMsForMode,
	resolveDocEditorCollabSaveMode,
	shouldRunAutosaveCanonicalPut,
} from '../utils/docEditorCollabSavePolicy';
import { DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS } from '../utils/docEditorPersistTiming';

export interface UseDocEditorAutosaveParams {
	editorStoreApi: StoreApi<EditorStore>;
	resolveHtmlForSaveRef: MutableRefObject<() => Promise<string>>;
	saveCurrentDocumentRef: MutableRefObject<(html: string) => Promise<unknown>>;
	payloadWantsUnifiedContentRef: MutableRefObject<boolean>;
	currentFileIdRef: MutableRefObject<string | null | undefined>;
	canPersistCanonicalRef: MutableRefObject<boolean>;
	canPersistUnifiedContentRef: MutableRefObject<boolean>;
	collaborationEnabledForEditorRef: MutableRefObject<boolean>;
	isCollabDocumentOwnerRef: MutableRefObject<boolean>;
	isDirty: boolean;
	isSaving: boolean;
	currentDocument: EditorStore['currentDocument'];
}

interface AutosaveRuntimeRefs {
	resolveHtmlForSaveRef: MutableRefObject<() => Promise<string>>;
	saveCurrentDocumentRef: MutableRefObject<(html: string) => Promise<unknown>>;
	payloadWantsUnifiedContentRef: MutableRefObject<boolean>;
	currentFileIdRef: MutableRefObject<string | null | undefined>;
	canPersistCanonicalRef: MutableRefObject<boolean>;
	canPersistUnifiedContentRef: MutableRefObject<boolean>;
	collaborationEnabledForEditorRef: MutableRefObject<boolean>;
	isCollabDocumentOwnerRef: MutableRefObject<boolean>;
}

export interface RunDocEditorAutosaveOptions {
	forceOwnerFlush?: boolean;
}

function resolveAutosaveCollabMode(
	refs: AutosaveRuntimeRefs,
	_options?: RunDocEditorAutosaveOptions
) {
	return resolveDocEditorCollabSaveMode({
		collaborationActive: refs.collaborationEnabledForEditorRef.current,
		isDocumentOwner: refs.isCollabDocumentOwnerRef.current,
		canPersistCanonical: refs.canPersistCanonicalRef.current,
	});
}

/** Один проход autosave: читает актуальный store + ref’ы capability. */
export async function runDocEditorAutosaveOnce(
	editorStoreApi: StoreApi<EditorStore>,
	refs: AutosaveRuntimeRefs,
	options?: RunDocEditorAutosaveOptions
): Promise<void> {
	const collabMode = resolveAutosaveCollabMode(refs, options);
	if (!shouldRunAutosaveCanonicalPut(collabMode, options)) {
		return;
	}

	const state = editorStoreApi.getState();
	if (!state.currentDocument || !state.isDirty || state.isSaving) {
		return;
	}
	if (
		refs.payloadWantsUnifiedContentRef.current &&
		!refs.currentFileIdRef.current
	) {
		return;
	}
	if (!refs.canPersistCanonicalRef.current) {
		return;
	}
	if (refs.currentFileIdRef.current) {
		if (!refs.canPersistUnifiedContentRef.current) {
			return;
		}
		try {
			const html = await refs.resolveHtmlForSaveRef.current();
			await refs.saveCurrentDocumentRef.current(html);
			editorStoreApi.setState({ isDirty: false });
		} catch {
			// автосохранение не блокирует редактирование
		}
		return;
	}
	const useVersionLock = !refs.collaborationEnabledForEditorRef.current;
	const html = await refs.resolveHtmlForSaveRef.current();
	await state.updateDocument(
		{ content: html },
		useVersionLock
			? {
					expectedVersion:
						state.currentDocument.version ??
						state.currentDocument.version_number ??
						null,
				}
			: {}
	);
}

export function useDocEditorAutosave(params: UseDocEditorAutosaveParams): {
	flushOwnerCollabCanonical: () => Promise<void>;
} {
	const {
		editorStoreApi,
		resolveHtmlForSaveRef,
		saveCurrentDocumentRef,
		payloadWantsUnifiedContentRef,
		currentFileIdRef,
		canPersistCanonicalRef,
		canPersistUnifiedContentRef,
		collaborationEnabledForEditorRef,
		isCollabDocumentOwnerRef,
		isDirty,
		isSaving,
		currentDocument,
	} = params;

	const autosaveRefs = useMemo(
		(): AutosaveRuntimeRefs => ({
			resolveHtmlForSaveRef,
			saveCurrentDocumentRef,
			payloadWantsUnifiedContentRef,
			currentFileIdRef,
			canPersistCanonicalRef,
			canPersistUnifiedContentRef,
			collaborationEnabledForEditorRef,
			isCollabDocumentOwnerRef,
		}),
		[
			resolveHtmlForSaveRef,
			saveCurrentDocumentRef,
			payloadWantsUnifiedContentRef,
			currentFileIdRef,
			canPersistCanonicalRef,
			canPersistUnifiedContentRef,
			collaborationEnabledForEditorRef,
			isCollabDocumentOwnerRef,
		]
	);

	const collabSaveMode = useMemo(
		() =>
			resolveDocEditorCollabSaveMode({
				collaborationActive: collaborationEnabledForEditorRef.current,
				isDocumentOwner: isCollabDocumentOwnerRef.current,
				canPersistCanonical: canPersistCanonicalRef.current,
			}),
		[
			collaborationEnabledForEditorRef,
			isCollabDocumentOwnerRef,
			canPersistCanonicalRef,
		]
	);

	const autosaveDebounceMs = autosaveDebounceMsForMode(collabSaveMode);

	const debouncedAutoSave = useMemo(
		() =>
			debounce(() => {
				void runDocEditorAutosaveOnce(editorStoreApi, autosaveRefs);
			}, autosaveDebounceMs),
		[editorStoreApi, autosaveRefs, autosaveDebounceMs]
	);

	useEffect(() => {
		if (!isDirty || isSaving || !currentDocument) {
			return;
		}
		if (!shouldRunAutosaveCanonicalPut(collabSaveMode)) {
			return;
		}
		debouncedAutoSave();

		const fallbackMs =
			collabSaveMode === 'owner_idle_put'
				? autosaveDebounceMs + 15_000
				: 30_000;

		const fallbackTimer = setTimeout(() => {
			void runDocEditorAutosaveOnce(editorStoreApi, autosaveRefs);
		}, fallbackMs);

		return (): void => {
			clearTimeout(fallbackTimer);
		};
	}, [
		isDirty,
		isSaving,
		currentDocument,
		debouncedAutoSave,
		editorStoreApi,
		autosaveRefs,
		collabSaveMode,
		autosaveDebounceMs,
	]);

	const flushOwnerCollabCanonical = useCallback(async (): Promise<void> => {
		await runDocEditorAutosaveOnce(editorStoreApi, autosaveRefs, {
			forceOwnerFlush: true,
		});
	}, [editorStoreApi, autosaveRefs]);

	return { flushOwnerCollabCanonical };
}

export { DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS };
