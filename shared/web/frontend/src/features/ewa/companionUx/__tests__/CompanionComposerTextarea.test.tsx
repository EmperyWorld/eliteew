/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionComposerTextarea (U8.3 slice 16 + expand toggle).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionComposerTextarea } from '@/features/ewa/companionUx/CompanionComposerTextarea';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionComposerTextarea', () => {
	it('sends on Enter without Shift', () => {
		const onSend = vi.fn();
		render(
			<CompanionComposerTextarea
				density="desktop"
				inputRef={{ current: null }}
				draft="Hi"
				pending={false}
				expanded={false}
				onExpandedChange={vi.fn()}
				onDraftChange={vi.fn()}
				onSend={onSend}
			/>
		);
		const field = screen.getByPlaceholderText('ewaCompanion.chatPlaceholder');
		fireEvent.keyDown(field, { key: 'Enter' });
		expect(onSend).toHaveBeenCalledOnce();
	});

	it('updates draft on change', () => {
		const onDraftChange = vi.fn();
		render(
			<CompanionComposerTextarea
				density="mobile"
				inputRef={{ current: null }}
				draft=""
				pending={false}
				expanded={false}
				onExpandedChange={vi.fn()}
				onDraftChange={onDraftChange}
				onSend={vi.fn()}
			/>
		);
		fireEvent.change(
			screen.getByPlaceholderText('ewaCompanion.chatPlaceholder'),
			{
				target: { value: 'test' },
			}
		);
		expect(onDraftChange).toHaveBeenCalledWith('test');
	});

	it('toggles expand via control and does not use native resize', () => {
		const onExpandedChange = vi.fn();
		render(
			<div data-ewa-composer-layout="" style={{ height: 400 }}>
				<CompanionComposerTextarea
					density="desktop"
					inputRef={{ current: null }}
					draft="long"
					pending={false}
					expanded={false}
					onExpandedChange={onExpandedChange}
					onDraftChange={vi.fn()}
					onSend={vi.fn()}
				/>
			</div>
		);
		const field = screen.getByPlaceholderText('ewaCompanion.chatPlaceholder');
		expect(field.className).toContain('resize-none');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.chatComposerExpandAria',
			})
		);
		expect(onExpandedChange).toHaveBeenCalledWith(true);
	});

	it('shows collapse control when expanded', () => {
		const onExpandedChange = vi.fn();
		render(
			<div data-ewa-composer-layout="" style={{ height: 400 }}>
				<CompanionComposerTextarea
					density="desktop"
					inputRef={{ current: null }}
					draft="long"
					pending={false}
					expanded={true}
					onExpandedChange={onExpandedChange}
					onDraftChange={vi.fn()}
					onSend={vi.fn()}
				/>
			</div>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.chatComposerCollapseAria',
			})
		);
		expect(onExpandedChange).toHaveBeenCalledWith(false);
	});
});
