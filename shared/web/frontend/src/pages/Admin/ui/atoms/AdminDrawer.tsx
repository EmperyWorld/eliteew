/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Side/drawer-style overlay for Admin New World editors (modal-sized panel).
 * Invariants: Tokens only; Escape closes when onClose provided.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { AdminModal, type AdminModalProps } from './AdminModal';

export type AdminDrawerProps = Omit<AdminModalProps, 'panelClassName'> & {
	children: ReactNode;
	wide?: boolean;
	panelClassName?: string;
};

/** Drawer is a wide AdminModal panel — shared overlay stack for Wave 2 editors. */
export function AdminDrawer({
	wide = true,
	children,
	panelClassName,
	...rest
}: AdminDrawerProps) {
	return (
		<AdminModal
			{...rest}
			panelClassName={panelClassName ?? (wide ? 'max-w-3xl' : undefined)}
		>
			{children}
		</AdminModal>
	);
}
