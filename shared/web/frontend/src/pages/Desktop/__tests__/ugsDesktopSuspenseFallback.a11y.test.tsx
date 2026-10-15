import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UGSDesktopSuspenseFallback } from '../components/UGSDesktopContainer';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	};
});

describe('UGSDesktopSuspenseFallback', () => {
	it('exposes loading state for assistive tech (role status + aria-busy + label)', () => {
		render(<UGSDesktopSuspenseFallback />);
		const el = screen.getByTestId('ugs-desktop-suspense-fallback');
		expect(el).toHaveAttribute('role', 'status');
		expect(el).toHaveAttribute('aria-busy', 'true');
		expect(el).toHaveAttribute('aria-label', 'suspenseLoadingAria');
	});

	it('uses motion-reduce on suspense spinner', () => {
		const { container } = render(<UGSDesktopSuspenseFallback />);
		expect(container.innerHTML).toContain('motion-reduce:animate-none');
	});
});
