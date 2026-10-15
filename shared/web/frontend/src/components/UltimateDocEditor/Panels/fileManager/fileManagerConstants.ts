/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared limits, sort metadata, preview helper, and lazy panel loaders for File Manager.
 *
 * Invariants:
 * - VIRTUAL_LIST_MIN threshold unchanged for VirtualVariableList switch.
 * - loadFileLibraryPanel / loadPaperlessPickerPanel match React.lazy import paths.
 *
 * Related:
 * - fileManager/FileManagerPanel.tsx
 * - documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md
 */

import {
	CalendarIcon,
	DocumentTextIcon,
	HashtagIcon,
} from '@heroicons/react/24/outline';

export const DOC_LIST_LIMIT = 50;
/** Use virtualized list when at or above this many rows in the main list */
export const VIRTUAL_LIST_MIN = 28;
export const ESTIMATE_ROW_PX = 132;
export const ESTIMATE_ROW_COMPACT_PX = 88;

export function stripHtmlPreview(html: string, maxLen: number): string {
	const plain = html
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (plain.length <= maxLen) {
		return plain;
	}
	return `${plain.slice(0, maxLen)}…`;
}

export const FILE_MANAGER_SORT_FIELDS = [
	{
		field: 'updated_at' as const,
		labelKey: 'fileManager.sortDate' as const,
		icon: CalendarIcon,
	},
	{
		field: 'title' as const,
		labelKey: 'fileManager.sortName' as const,
		icon: DocumentTextIcon,
	},
	{
		field: 'word_count' as const,
		labelKey: 'fileManager.sortWords' as const,
		icon: HashtagIcon,
	},
] as const;

export const loadFileLibraryPanel = () => import('../FileLibraryPanel');
export const loadPaperlessPickerPanel = () =>
	import('@/components/Paperless/PaperlessPickerPanel');
