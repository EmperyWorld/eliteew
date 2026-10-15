/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for companion embedded document editor mode; thin re-export facade.
 *
 * Invariants:
 * - Named export CompanionDocumentEditorMode preserved for CompanionOutputSurface + Vitest.
 * - Implementation lives under ./companionDocumentEditor/ (≤800 LOC per child).
 *
 * Related:
 * - companionDocumentEditor/CompanionDocumentEditorMode.tsx
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

export { CompanionDocumentEditorMode } from './companionDocumentEditor/CompanionDocumentEditorMode';
export type { CompanionDocumentEditorModeProps } from './companionDocumentEditor/types';
