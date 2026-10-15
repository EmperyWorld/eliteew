/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Wave 0 locks for Admin New World tokens + DangerConfirmModal gate.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
	ADMIN_UI_ROOT_CLASS,
	adminUiButtonVariant,
	adminUiFieldClass,
} from '../adminTokens';
import { DangerConfirmModal } from '../atoms/DangerConfirmModal';

describe('adminTokens', () => {
	it('exports stable root class and required variants', () => {
		expect(ADMIN_UI_ROOT_CLASS).toBe('eliteew-admin-ui');
		expect(adminUiButtonVariant.primary).toContain('admin-ui-accent');
		expect(adminUiButtonVariant.danger).toContain('admin-ui-status-danger');
		expect(adminUiFieldClass).toContain('admin-ui-border');
	});
});

describe('DangerConfirmModal', () => {
	it('keeps confirm disabled until phrase matches', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		render(
			<div className={ADMIN_UI_ROOT_CLASS}>
				<DangerConfirmModal
					open
					title="Delete entity"
					confirmPhrase="DELETE"
					onCancel={onCancel}
					onConfirm={onConfirm}
				/>
			</div>
		);

		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		expect(confirmBtn).toBeDisabled();

		await user.type(screen.getByLabelText('Type to confirm'), 'DELETE');
		expect(confirmBtn).not.toBeDisabled();

		await user.click(confirmBtn);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});

describe('EntityLifecycleBar', () => {
	it('renders delete action when onDelete is provided', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		const { EntityLifecycleBar } = await import('../atoms/EntityLifecycleBar');

		render(
			<div className={ADMIN_UI_ROOT_CLASS}>
				<EntityLifecycleBar onDelete={onDelete} deleteLabel="Retire">
					<span>extra</span>
				</EntityLifecycleBar>
			</div>
		);

		await user.click(screen.getByRole('button', { name: 'Retire' }));
		expect(onDelete).toHaveBeenCalledTimes(1);
		expect(screen.getByText('extra')).toBeInTheDocument();
	});
});
