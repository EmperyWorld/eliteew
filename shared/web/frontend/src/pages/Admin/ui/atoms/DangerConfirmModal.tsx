/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Type-to-confirm destructive dialog for Admin New World.
 * Invariants: Confirm disabled until typed phrase matches; no Old World imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useEffect, useState } from 'react';

import { AdminButton } from './AdminButton';
import { AdminField } from './AdminField';
import { AdminModal } from './AdminModal';

export type DangerConfirmModalProps = {
	open: boolean;
	title: string;
	description?: string;
	/** Exact string the operator must type to enable confirm. */
	confirmPhrase: string;
	confirmLabel?: string;
	cancelLabel?: string;
	phraseLabel?: string;
	busy?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

export function DangerConfirmModal({
	open,
	title,
	description,
	confirmPhrase,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	phraseLabel = 'Type to confirm',
	busy = false,
	onCancel,
	onConfirm,
}: DangerConfirmModalProps) {
	const [typed, setTyped] = useState('');
	const matched = typed.trim() === confirmPhrase.trim();

	useEffect(() => {
		if (open) setTyped('');
	}, [open]);

	return (
		<AdminModal
			open={open}
			title={title}
			onClose={busy ? undefined : onCancel}
			closeOnBackdrop={!busy}
			footer={
				<>
					<AdminButton variant="ghost" disabled={busy} onClick={onCancel}>
						{cancelLabel}
					</AdminButton>
					<AdminButton
						variant="danger"
						disabled={!matched || busy}
						onClick={onConfirm}
					>
						{confirmLabel}
					</AdminButton>
				</>
			}
		>
			{description ? (
				<p className="mb-3 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					{description}
				</p>
			) : null}
			<p className="mb-1 text-[length:var(--admin-ui-text-xs)] text-[var(--admin-ui-fg-dim)]">
				{phraseLabel}:{' '}
				<code className="text-[var(--admin-ui-fg)]">{confirmPhrase}</code>
			</p>
			<AdminField
				aria-label={phraseLabel}
				value={typed}
				disabled={busy}
				autoComplete="off"
				onChange={(e) => setTyped(e.target.value)}
			/>
		</AdminModal>
	);
}
