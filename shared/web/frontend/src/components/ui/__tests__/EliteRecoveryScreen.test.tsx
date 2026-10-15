/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ELITE_QUOTE_ROTATION_MS } from '../eliteQuotes';
import { EliteRecoveryScreen } from '../EliteRecoveryScreen';

describe('EliteRecoveryScreen', () => {
	it('shows status pill and quote author without product authorship footer', () => {
		const { container } = render(
			<EliteRecoveryScreen
				statusLabel="Проверяем связь"
				quote={{
					id: 'kutuzov-wait',
					author: 'Михаил Кутузов',
					text: 'Чтобы победить, надо уметь терпеть и ждать.',
					category: 'perseverance',
				}}
			/>
		);
		expect(container.querySelector('.elite-recovery-status-pill')).toBeTruthy();
		expect(screen.getByText('Проверяем связь')).toBeTruthy();
		expect(screen.getByText('Михаил Кутузов')).toBeTruthy();
		expect(screen.queryByText('po&T && TZBrand')).toBeNull();
	});

	it('renders optional recovery action', () => {
		render(
			<EliteRecoveryScreen
				actionLabel="Проверить связь"
				onAction={() => undefined}
				quote={null}
				panelVariant="recovery"
			/>
		);
		expect(
			screen.getByRole('button', { name: 'Проверить связь' })
		).toBeTruthy();
		expect(screen.getByText('Связь восстанавливается')).toBeTruthy();
	});

	it('shows visible description subtitle', () => {
		const { container } = render(
			<EliteRecoveryScreen
				statusLabel="Проверяем связь"
				description="Безраздельный мир временно на паузе."
				quote={null}
			/>
		);
		const subtitle = container.querySelector('.elite-recovery-subtitle');
		expect(subtitle?.textContent).toBe('Безраздельный мир временно на паузе.');
	});

	it('applies enter + ambient-static classes by default (no infinite CSS loops)', () => {
		const { container } = render(
			<EliteRecoveryScreen statusLabel="Проверяем связь" quote={null} />
		);
		expect(container.querySelector('.elite-recovery-enter')).toBeTruthy();
		expect(
			container.querySelector('.elite-recovery-ambient-static')
		).toBeTruthy();
	});

	describe('quote rotation', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('does not rotate quotes by default (idle GPU budget)', () => {
			const { container } = render(
				<EliteRecoveryScreen
					statusLabel="Проверяем связь"
					panelVariant="recovery"
				/>
			);
			const cite = () =>
				container.querySelector('.elite-quote-author')?.textContent ?? '';
			const first = cite();
			expect(first.length).toBeGreaterThan(0);

			act(() => {
				vi.advanceTimersByTime(ELITE_QUOTE_ROTATION_MS * 3);
			});
			expect(cite()).toBe(first);
		});

		it('rotates when quoteRotationIntervalMs is explicitly set', () => {
			const { container } = render(
				<EliteRecoveryScreen
					statusLabel="Проверяем связь"
					panelVariant="recovery"
					quoteRotationIntervalMs={ELITE_QUOTE_ROTATION_MS}
				/>
			);
			const cite = () =>
				container.querySelector('.elite-quote-author')?.textContent ?? '';
			const first = cite();
			expect(first.length).toBeGreaterThan(0);

			act(() => {
				vi.advanceTimersByTime(ELITE_QUOTE_ROTATION_MS);
			});
			expect(cite()).not.toBe(first);
		});
	});
});
