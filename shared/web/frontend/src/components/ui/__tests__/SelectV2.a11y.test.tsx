/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Accessibility regression coverage for the shared custom SelectV2 component.
 *
 * Invariants:
 * - Trigger exposes combobox state and popup exposes listbox/options.
 * - Keyboard selection must call the same change contract as pointer selection.
 *
 * Related:
 * - src/components/ui/SelectV2.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { SelectV2 } from '../SelectV2';

const OPTIONS = [
	{ value: 'alpha', label: 'Alpha' },
	{ value: 'beta', label: 'Beta' },
	{ value: 'gamma', label: 'Gamma' },
];

describe('SelectV2 accessibility contract', () => {
	it('exposes combobox/listbox roles and selects with keyboard', async () => {
		const onChange = vi.fn();
		render(<SelectV2 label="Mode" options={OPTIONS} onChange={onChange} />);

		const trigger = screen.getByRole('combobox', { name: 'Mode' });
		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('listbox', { name: 'Mode' })).toBeInTheDocument();
		expect(screen.getAllByRole('option')).toHaveLength(3);

		fireEvent.keyDown(document, { key: 'ArrowDown' });
		fireEvent.keyDown(document, { key: 'Enter' });

		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith('beta');
		});
	});

	it('uses commonUi fallback labels for placeholder and no results', () => {
		render(
			<SelectV2 label="Mode" options={OPTIONS} onChange={vi.fn()} searchable />
		);

		expect(screen.getByText('Выберите вариант')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('combobox', { name: 'Mode' }));
		fireEvent.change(screen.getByRole('textbox', { name: 'Найти' }), {
			target: { value: 'zzz' },
		});
		expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
	});
});
