/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Default assistant context actions for desktop expansion settings hydration.
 *
 * Invariants:
 * - Used when shell_state assistant_context_actions is empty or missing.
 *
 * Related:
 * - useDesktopExpansionShellCore.ts
 */

import type { DesktopAssistantContextAction } from '../../types/desktopExpansion.types';

export const DEFAULT_ASSISTANT_ACTIONS: DesktopAssistantContextAction[] = [
	{
		id: 'explain-selection',
		label: 'explainSelection',
		source: 'selection',
		assistantTarget: 'assistant',
		enabled: true,
	},
	{
		id: 'summarize-window',
		label: 'summarizeWindow',
		source: 'window-toolbar',
		assistantTarget: 'assistant',
		enabled: true,
	},
	{
		id: 'send-to-gaf',
		label: 'sendToGaf',
		source: 'context-menu',
		assistantTarget: 'gaf',
		enabled: true,
	},
	{
		id: 'create-task',
		label: 'createTask',
		source: 'properties-panel',
		assistantTarget: 'assistant',
		enabled: true,
	},
];
