/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for DocumentImportPanel; implementation lives in documentImport/.
 *
 * Invariants:
 * - Named export `DocumentImportPanel` preserved for UltimateDocEditorPanelOverlays lazy path:
 *   import('../Panels/DocumentImportPanel').then(m => ({ default: m.DocumentImportPanel }))
 *
 * Related:
 * - documentImport/DocumentImportPanel.tsx
 * - chrome/UltimateDocEditorPanelOverlays.tsx
 */

export { DocumentImportPanel } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportPanel';
export type { DocumentImportPanelProps } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';
