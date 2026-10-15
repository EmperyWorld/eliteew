/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for shared AudioTransportControls primitive.
 *
 * Invariants:
 * - Loading mode disables primary toggle while keeping prev/next interaction gates.
 *
 * Related:
 * - src/components/Audio/AudioTransportControls.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AudioTransportControls } from '@/components/Audio/AudioTransportControls';

describe('AudioTransportControls', () => {
	it('fires prev/play-next callbacks when controls are available', () => {
		const onPrev = vi.fn();
		const onToggle = vi.fn();
		const onNext = vi.fn();
		render(
			<AudioTransportControls
				playing={false}
				hasPrev
				hasNext
				onPrev={onPrev}
				onTogglePlayPause={onToggle}
				onNext={onNext}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Предыдущий трек' }));
		fireEvent.click(screen.getByRole('button', { name: 'Воспроизведение' }));
		fireEvent.click(screen.getByRole('button', { name: 'Следующий трек' }));
		expect(onPrev).toHaveBeenCalledTimes(1);
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it('shows loading state and disables primary transport action', () => {
		const onToggle = vi.fn();
		render(
			<AudioTransportControls playing isLoading onTogglePlayPause={onToggle} />
		);
		const loadingButton = screen.getByRole('button', {
			name: 'Загрузка трека',
		});
		expect(loadingButton).toBeDisabled();
		fireEvent.click(loadingButton);
		expect(onToggle).not.toHaveBeenCalled();
	});
});
