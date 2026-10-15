/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin modal shell (backdrop + panel).
 * Invariants: Tokens only; Escape / backdrop click optional via props.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { type MouseEvent, type ReactNode, useEffect } from 'react';

import { cn } from '@/utils/cn';

import {
	adminUiModalBackdropClass,
	adminUiModalPanelClass,
} from '../adminTokens';

export type AdminModalProps = {
	open: boolean;
	title?: string;
	children: ReactNode;
	footer?: ReactNode;
	onClose?: () => void;
	className?: string;
	panelClassName?: string;
	/** When true, backdrop click calls onClose. Default true. */
	closeOnBackdrop?: boolean;
};

export function AdminModal({
	open,
	title,
	children,
	footer,
	onClose,
	className,
	panelClassName,
	closeOnBackdrop = true,
}: AdminModalProps) {
	useEffect(() => {
		if (!open || !onClose) return;
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
		if (!closeOnBackdrop || !onClose) return;
		if (e.target === e.currentTarget) onClose();
	};

	return (
		// Backdrop dismiss is intentional; Escape handled via window listener.
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop pattern
		<div
			className={cn(adminUiModalBackdropClass, className)}
			role="presentation"
			onClick={onBackdrop}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={cn(adminUiModalPanelClass, panelClassName)}
			>
				{title ? (
					<h2 className="mb-3 text-[length:var(--admin-ui-text-md)] font-semibold text-[var(--admin-ui-fg)]">
						{title}
					</h2>
				) : null}
				<div>{children}</div>
				{footer ? (
					<div className="mt-4 flex justify-end gap-2">{footer}</div>
				) : null}
			</div>
		</div>
	);
}
