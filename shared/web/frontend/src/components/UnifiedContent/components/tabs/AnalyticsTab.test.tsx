/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for UnifiedContent AnalyticsTab — quota display must come from API hook, not hardcoded limits.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsTab } from './AnalyticsTab';
import type { ContentStats } from '../../types';

const FIVE_GIB = 5 * 1024 * 1024 * 1024;
const TWENTY_GIB = 20 * 1024 * 1024 * 1024;

const mockFetchQuota = vi.fn();

vi.mock('@/pages/ContentManager/hooks/useContentManagerQuota', () => ({
	useContentManagerQuota: vi.fn(),
}));

import { useContentManagerQuota } from '@/pages/ContentManager/hooks/useContentManagerQuota';

const mockedUseContentManagerQuota = vi.mocked(useContentManagerQuota);

const baseStats: ContentStats = {
	totalFiles: 12,
	totalSize: FIVE_GIB,
	typeDistribution: { image: 4, document: 8 },
	recentActivity: 3,
	topTags: [{ tag: 'draft', count: 2 }],
};

describe('AnalyticsTab quota contract', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetchQuota.mockReset();
	});

	it('shows loading placeholders while quota is loading', () => {
		mockedUseContentManagerQuota.mockReturnValue({
			quotaBytesUsed: null,
			quotaBytesLimit: null,
			quotaLoading: true,
			quotaError: null,
			fetchQuota: mockFetchQuota,
		});

		const { container } = render(<AnalyticsTab stats={baseStats} />);

		expect(screen.getByText('Использование хранилища')).toBeTruthy();
		expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
	});

	it('renders API quota limit instead of a hardcoded 10 GiB cap', () => {
		mockedUseContentManagerQuota.mockReturnValue({
			quotaBytesUsed: FIVE_GIB,
			quotaBytesLimit: TWENTY_GIB,
			quotaLoading: false,
			quotaError: null,
			fetchQuota: mockFetchQuota,
		});

		render(<AnalyticsTab stats={baseStats} />);

		expect(screen.getByText(/5.*ГБ \/ 20.*ГБ/)).toBeTruthy();
		expect(screen.getByText('25.00% от доступной квоты')).toBeTruthy();
		expect(screen.queryByText(/10\s*ГБ|10\s*GB/i)).toBeNull();
	});

	it('shows honest error state with retry when quota fetch fails', () => {
		mockedUseContentManagerQuota.mockReturnValue({
			quotaBytesUsed: null,
			quotaBytesLimit: null,
			quotaLoading: false,
			quotaError: 'network',
			fetchQuota: mockFetchQuota,
		});

		render(<AnalyticsTab stats={baseStats} />);

		expect(
			screen.getByText(
				'Не удалось загрузить квоту хранилища. Файлы по-прежнему доступны.'
			)
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
		expect(mockFetchQuota).toHaveBeenCalledTimes(1);
	});

	it('shows used-only copy when API returns no configured limit', () => {
		mockedUseContentManagerQuota.mockReturnValue({
			quotaBytesUsed: FIVE_GIB,
			quotaBytesLimit: null,
			quotaLoading: false,
			quotaError: null,
			fetchQuota: mockFetchQuota,
		});

		render(<AnalyticsTab stats={baseStats} />);

		expect(
			screen.getByText('Использовано: 5 ГБ (лимит не задан)')
		).toBeTruthy();
	});
});
