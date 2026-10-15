/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lifecycle action cluster (retire/delete) for Admin New World entities.
 * Invariants: Destructive actions are callbacks only; parent owns DangerConfirmModal.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { AdminButton } from './AdminButton';
import { AdminRowActions } from './AdminRowActions';

export type EntityLifecycleBarProps = {
	children?: ReactNode;
	onDelete?: () => void;
	deleteLabel?: string;
	deleteDisabled?: boolean;
	className?: string;
};

export function EntityLifecycleBar({
	children,
	onDelete,
	deleteLabel = 'Delete',
	deleteDisabled = false,
	className,
}: EntityLifecycleBarProps) {
	return (
		<AdminRowActions className={cn(className)}>
			{children}
			{onDelete ? (
				<AdminButton
					variant="danger"
					disabled={deleteDisabled}
					onClick={onDelete}
				>
					{deleteLabel}
				</AdminButton>
			) : null}
		</AdminRowActions>
	);
}
