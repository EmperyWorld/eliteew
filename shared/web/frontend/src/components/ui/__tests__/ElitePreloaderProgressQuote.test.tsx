/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ElitePreloaderPanel } from '../ElitePreloaderPanel';
import { ElitePreloaderProgressQuote } from '../ElitePreloaderProgressQuote';

describe('ElitePreloaderProgressQuote', () => {
	it('shows boot progress scale by default', () => {
		render(<ElitePreloaderProgressQuote variant="boot" />);
		expect(screen.getByText('0%')).toBeTruthy();
		expect(screen.getByText('100%')).toBeTruthy();
	});

	it('shows indeterminate recovery progress without fake percentages', () => {
		render(<ElitePreloaderProgressQuote variant="recovery" />);
		expect(screen.queryByText('0%')).toBeNull();
		expect(screen.getByText('Связь восстанавливается')).toBeTruthy();
	});
});

describe('ElitePreloaderPanel', () => {
	it('renders recovery ornament for recovery variant', () => {
		const { container } = render(
			<ElitePreloaderPanel variant="recovery" quote={undefined} />
		);
		expect(container.querySelector('.elite-recovery-ornament')).toBeTruthy();
	});
});
