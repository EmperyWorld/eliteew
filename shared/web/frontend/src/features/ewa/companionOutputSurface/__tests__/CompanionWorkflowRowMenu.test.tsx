/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for workflow row action-menu accessibility semantics.
 *
 * Invariants:
 * - Menu trigger exposes expanded/controls state.
 * - Disabled row actions cannot open the menu.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionWorkflowRowMenu.tsx
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionWorkflowRowMenu } from '@/features/ewa/companionOutputSurface/CompanionWorkflowRowMenu';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				'ewaCompanion.userWorkflowEditActionsAria': 'Workflow actions',
				'ewaCompanion.userWorkflowEditEdit': 'Edit',
				'ewaCompanion.userWorkflowEditDuplicate': 'Duplicate',
				'ewaCompanion.userWorkflowEditDisable': 'Disable',
				'ewaCompanion.userWorkflowEditEnable': 'Enable',
				'ewaCompanion.userWorkflowEditDelete': 'Delete',
			};
			return map[key] ?? key;
		},
	}),
}));

const renderMenu = (
	props?: Partial<Parameters<typeof CompanionWorkflowRowMenu>[0]>
) =>
	render(
		<CompanionWorkflowRowMenu
			enabled
			onEdit={vi.fn()}
			onDuplicate={vi.fn()}
			onToggleEnabled={vi.fn()}
			onDelete={vi.fn()}
			{...props}
		/>
	);

describe('CompanionWorkflowRowMenu', () => {
	it('exposes trigger expanded state and menu items', () => {
		renderMenu();

		const trigger = screen.getByRole('button', { name: 'Workflow actions' });
		expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(trigger).toHaveAttribute('aria-controls');

		fireEvent.click(trigger);

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		const menu = screen.getByRole('menu');
		expect(menu.id).toBe(trigger.getAttribute('aria-controls'));
		expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
		expect(
			within(menu).getByRole('menuitem', { name: 'Disable' })
		).toBeInTheDocument();
	});

	it('marks disabled trigger and prevents opening', () => {
		renderMenu({ disabled: true });

		const trigger = screen.getByRole('button', { name: 'Workflow actions' });
		expect(trigger).toBeDisabled();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(trigger);

		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('omits edit and duplicate items when handlers are absent', () => {
		renderMenu({ onEdit: undefined, onDuplicate: undefined });

		fireEvent.click(screen.getByRole('button', { name: 'Workflow actions' }));

		const menu = screen.getByRole('menu');
		expect(within(menu).queryByRole('menuitem', { name: 'Edit' })).toBeNull();
		expect(
			within(menu).queryByRole('menuitem', { name: 'Duplicate' })
		).toBeNull();
		expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
	});
});
