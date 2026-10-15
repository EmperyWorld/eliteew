/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command Palette props and command row types (P26 extract from CommandPalette.tsx).
 *
 * Invariants:
 * - P12: no `apps` groupKind — Start owns the app catalog.
 *
 * Related:
 * - components/CommandPalette.tsx
 * - useCommandPaletteModel.ts
 */

import type * as React from 'react';
import type { DesktopWindowStyle } from '@/types/profile';

export interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onAction?: (action: string) => void;
	shellWindowStyle?: DesktopWindowStyle;
}

export type CommandPaletteGroupKind =
	| 'actions'
	| 'system'
	| 'virtualDesktops'
	| 'tools'
	| 'info';

export interface CommandItem {
	id: string;
	name: string;
	description?: string;
	/** Secondary line for read-only info rows (e.g. calendar honesty hint). */
	infoHint?: string;
	/** Extra cmdk filter tokens not shown in the row title. */
	searchExtra?: string;
	icon: React.ReactNode;
	shortcut?: string;
	action: () => void;
	groupKind: CommandPaletteGroupKind;
	/** Read-only info row — selectable for reading, does not run shell actions. */
	isInfo?: boolean;
}
