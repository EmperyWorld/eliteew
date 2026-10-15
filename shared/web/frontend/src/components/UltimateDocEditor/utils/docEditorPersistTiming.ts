/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единые интервалы debounce для autosave и draft в Ultimate Doc Editor.
 *
 * Invariants:
 * - Draft срабатывает после autosave, чтобы не дублировать getHTML/PUT при наборе.
 *
 * Related:
 * - `hooks/useDocEditorAutosave.ts`, `hooks/useDocEditorDraftPersistence.ts`
 */

/** Canonical PUT / unified content save после паузы в наборе. */
export const DOC_EDITOR_AUTOSAVE_DEBOUNCE_MS = 3000;

/** Владелец в live collab: один canonical PUT после простоя (Yjs — live source). */
export const DOC_EDITOR_COLLAB_IDLE_CANONICAL_MS = 90_000;

/** Server/local draft — fallback после autosave, если документ всё ещё dirty. */
export const DOC_EDITOR_DRAFT_DEBOUNCE_MS = 4500;

/** EWA companion excerpt в shell payload окна (не на каждый keystroke). */
export const DOC_EDITOR_COMPANION_EXCERPT_DEBOUNCE_MS = 8000;

/** EWA selection excerpt — реже, чем cursor/selection updates. */
export const DOC_EDITOR_COMPANION_SELECTION_DEBOUNCE_MS = 2500;
