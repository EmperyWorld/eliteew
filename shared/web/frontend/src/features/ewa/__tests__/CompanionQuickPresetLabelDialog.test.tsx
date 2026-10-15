/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component regression for quick preset label save/rename modal (Phase 5.4).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionQuickPresetLabelDialog } from '@/features/ewa/CompanionQuickPresetLabelDialog';

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
		t: (key: string) => key,
	}),
}));

describe('CompanionQuickPresetLabelDialog', () => {
	it('submits trimmed label on confirm', () => {
		const onConfirm = vi.fn();
		const inputRef = createRef<HTMLInputElement>();
		render(
			<CompanionQuickPresetLabelDialog
				state={{ mode: 'save', value: 'My phrase', promptText: 'draft text' }}
				inputRef={inputRef}
				onValueChange={vi.fn()}
				onCancel={vi.fn()}
				onConfirm={onConfirm}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.quickPresetDialogConfirm',
			})
		);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
