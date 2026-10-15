/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for FileManagerPanel; implementation lives in fileManager/.
 *
 * Invariants:
 * - Named export `FileManagerPanel` preserved for UltimateDocEditorPanelOverlays lazy path:
 *   import('../Panels/FileManagerPanel').then(m => ({ default: m.FileManagerPanel }))
 *
 * Related:
 * - fileManager/FileManagerPanel.tsx
 * - chrome/UltimateDocEditorPanelOverlays.tsx
 */

export { FileManagerPanel } from '@/components/UltimateDocEditor/Panels/fileManager/FileManagerPanel';
export type { FileManagerPanelProps } from '@/components/UltimateDocEditor/Panels/fileManager/fileManagerTypes';
