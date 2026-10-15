/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared callback/types for desktop window app content resolution.
 *
 * Invariants:
 * - Public import path remains `desktopWindowAppContent` re-export.
 *
 * Related:
 * - desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 */

import type { DesktopWindowStyle } from '@/types/profile';
import type { WindowInitialPayload } from '../../types/desktop.types';

export type DesktopWindowAppCallbacks = {
	onClose?: () => void;
	onMaximize?: () => void;
	onUpdatePayload?: (payload: WindowInitialPayload) => void;
	visualStyle?: DesktopWindowStyle;
};
