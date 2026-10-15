/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionPendingImagePreview (U8.3 slice 14).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionPendingImagePreview } from '@/features/ewa/companionUx/CompanionPendingImagePreview';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionPendingImagePreview', () => {
	it('returns null without pending image', () => {
		const { container } = render(
			<CompanionPendingImagePreview
				pendingImage={null}
				pending={false}
				onClear={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});

	it('clears pending image preview', () => {
		const onClear = vi.fn();
		render(
			<CompanionPendingImagePreview
				pendingImage={{
					previewUrl: 'blob:preview',
					mimeType: 'image/png',
					dataBase64: 'abc',
				}}
				pending={false}
				onClear={onClear}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.chatImagePreviewRemove',
			})
		);
		expect(onClear).toHaveBeenCalledOnce();
	});
});
