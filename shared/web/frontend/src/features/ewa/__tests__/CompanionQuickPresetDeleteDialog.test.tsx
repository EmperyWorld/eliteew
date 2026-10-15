/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component regression for quick preset delete confirm modal (Phase 5.4).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionQuickPresetDeleteDialog } from '@/features/ewa/CompanionQuickPresetDeleteDialog';

vi.mock('@/pages/Desktop/components/DesktopAppChrome', () => ({
	DesktopAppButton: ({
		children,
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
		<button {...props}>{children}</button>
	),
	DESKTOP_TYPOGRAPHY: {
		subtitle: 'subtitle',
		caption: 'caption',
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { label?: string }) => {
			if (key === 'ewaCompanion.quickPresetDeleteConfirm') {
				return `Delete ${opts?.label ?? ''}?`;
			}
			return key;
		},
	}),
}));

describe('CompanionQuickPresetDeleteDialog', () => {
	it('calls onConfirm when delete is confirmed', () => {
		const onConfirm = vi.fn();
		render(
			<CompanionQuickPresetDeleteDialog
				label="My preset"
				onCancel={vi.fn()}
				onConfirm={onConfirm}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.quickPresetDeleteDialogConfirm',
			})
		);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
