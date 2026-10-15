/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for shared AudioTrackMeta primitive.
 *
 * Invariants:
 * - Retry button appears only when error and callback are provided.
 *
 * Related:
 * - src/components/Audio/AudioTrackMeta.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AudioTrackMeta } from '@/components/Audio/AudioTrackMeta';

describe('AudioTrackMeta', () => {
	it('renders label and title without uppercase shout on default eyebrow', () => {
		render(
			<AudioTrackMeta
				contentId="track-1"
				title="Neon City"
				titleLabel="Сейчас играет"
			/>
		);
		const label = screen.getByText('Сейчас играет');
		expect(label).toBeInTheDocument();
		expect(label.className).not.toMatch(/\buppercase\b/);
		expect(
			screen.getByRole('heading', { name: 'Neon City' })
		).toBeInTheDocument();
	});

	it('stretches to full width in flex parents by default', () => {
		const { container } = render(
			<AudioTrackMeta contentId="track-3" title="Wide Track" />
		);
		expect(container.firstElementChild).toHaveClass('w-full');
	});

	it('renders retry action for error state', () => {
		const onRetry = vi.fn();
		render(
			<AudioTrackMeta
				contentId="track-2"
				title="Broken Song"
				error="Ошибка воспроизведения"
				onRetryError={onRetry}
				retryLabel="Повторить"
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
