/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EWDesk news image hide-on-error: a later blob URL must show again.
 *
 * Invariants:
 * - onError hides the slot; a new `blobUrl` remounts the img.
 *
 * Related:
 * - EwDeskNewsMedia.tsx
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const blobState = vi.hoisted(() => ({
	url: 'blob:https://app.eliteew.ru/one',
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../useEwDeskNewsBlob', () => ({
	useEwDeskNewsBlob: () => ({
		blobUrl: blobState.url,
		isLoading: false,
		failed: false,
	}),
}));

import { EwDeskNewsImage } from '../EwDeskNewsMedia';

describe('EwDeskNewsImage hide-on-error', () => {
	it('shows the image again when blobUrl changes after onError', () => {
		blobState.url = 'blob:https://app.eliteew.ru/one';
		const { rerender } = render(
			<EwDeskNewsImage contentId="content-1" alt="cover" />
		);
		const first = screen.getByRole('img', { name: 'cover' });
		act(() => {
			fireEvent.error(first);
		});
		expect(screen.queryByRole('img', { name: 'cover' })).toBeNull();

		blobState.url = 'blob:https://app.eliteew.ru/two';
		rerender(<EwDeskNewsImage contentId="content-1" alt="cover" />);
		expect(screen.getByRole('img', { name: 'cover' })).toHaveAttribute(
			'src',
			'blob:https://app.eliteew.ru/two'
		);
	});
});
