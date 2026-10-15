/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for AIAssistantPanel; implementation lives in aiAssistant/.
 *
 * Invariants:
 * - Named export `AIAssistantPanel` preserved for UltimateDocEditorMainGrid lazy path:
 *   import('../Panels/AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel }))
 *
 * Related:
 * - aiAssistant/AIAssistantPanel.tsx
 * - chrome/UltimateDocEditorMainGrid.tsx
 */

export { AIAssistantPanel } from '@/components/UltimateDocEditor/Panels/aiAssistant/AIAssistantPanel';
export type { AIAssistantPanelProps } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
