/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public and row-level prop types for File Manager panel atomization.
 *
 * Invariants:
 * - FileManagerPanelProps shape unchanged for UltimateDocEditorPanelOverlays.
 *
 * Related:
 * - Panels/FileManagerPanel.tsx (facade)
 * - fileManager/FileManagerPanel.tsx
 */

import type * as React from 'react';
import type { UltimateDocument } from '../../types/editor.types';

export interface FileManagerPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenImport: () => void;
	onSelectDocument: (document: UltimateDocument) => void | Promise<void>;
}

export type SortField = 'updated_at' | 'title' | 'word_count';
export type SortOrder = 'asc' | 'desc';

export type FileManagerDocRowProps = {
	doc: UltimateDocument;
	currentDocument: UltimateDocument | null;
	isSelected: boolean;
	compact: boolean;
	onToggleSelectId: (id: string) => void;
	onOpenDocument: (document: UltimateDocument) => void;
	onAskAi?: (document: UltimateDocument) => void;
	onDeleteClick: (id: string) => void;
	formatRelativeDate: (dateString: string) => string;
	displayWordCount: number;
	title: string;
	onContextMenuRow?: (e: React.MouseEvent) => void;
};

export type FileManagerRecentDocRowProps = {
	doc: UltimateDocument;
	onOpenDocument: (document: UltimateDocument) => void;
	onContextMenu?: (e: React.MouseEvent) => void;
};
