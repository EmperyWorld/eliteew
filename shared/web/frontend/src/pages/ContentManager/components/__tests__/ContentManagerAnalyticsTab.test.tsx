/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for ContentManagerAnalyticsTab — quota display must come from API props, not hardcoded limits.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentManagerAnalyticsTab } from '../ContentManagerAnalyticsTab';
import { renderWithCmProHarness } from '../../__tests__/cmProTestHarness';

const FIVE_GIB = 5 * 1024 * 1024 * 1024;
const TWENTY_GIB = 20 * 1024 * 1024 * 1024;
const TEN_GIB = 10 * 1024 * 1024 * 1024;

const formatSize = (bytes: number): string => {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
	}
	return `${bytes} B`;
};

const baseProps = {
	shellContentPanelClass: 'shell-panel',
	formatSize,
	quotaBytesUsed: null,
	quotaBytesLimit: null,
	quotaLoading: false,
	quotaError: null,
	onQuotaRetry: vi.fn(),
};

describe('ContentManagerAnalyticsTab quota contract', () => {
	it('shows loading skeleton while quota is loading', () => {
		renderWithCmProHarness(
			<ContentManagerAnalyticsTab {...baseProps} quotaLoading />
		);
		expect(screen.getByText('Storage usage')).toBeTruthy();
	});

	it('renders API quota limit instead of a hardcoded 10 GiB cap', () => {
		renderWithCmProHarness(
			<ContentManagerAnalyticsTab
				{...baseProps}
				quotaBytesUsed={FIVE_GIB}
				quotaBytesLimit={TWENTY_GIB}
			/>
		);
		expect(screen.getByText(/Storage: 5 GB of 20 GB/)).toBeTruthy();
		expect(screen.getByText('25.0% of your quota')).toBeTruthy();
		expect(screen.queryByText(/10 GB/)).toBeNull();
	});

	it('does not treat legacy 10 GiB as the default displayed limit', () => {
		renderWithCmProHarness(
			<ContentManagerAnalyticsTab
				{...baseProps}
				quotaBytesUsed={FIVE_GIB}
				quotaBytesLimit={TEN_GIB}
			/>
		);
		expect(screen.getByText(/Storage: 5 GB of 10 GB/)).toBeTruthy();
		expect(screen.getByText('50.0% of your quota')).toBeTruthy();
	});

	it('shows honest error state with retry when quota fetch fails', () => {
		const onQuotaRetry = vi.fn();
		renderWithCmProHarness(
			<ContentManagerAnalyticsTab
				{...baseProps}
				quotaError="network"
				onQuotaRetry={onQuotaRetry}
			/>
		);
		expect(
			screen.getByText(
				'Could not load storage quota. Your files are still available.'
			)
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onQuotaRetry).toHaveBeenCalledTimes(1);
	});

	it('shows used-only copy when API returns no configured limit', () => {
		renderWithCmProHarness(
			<ContentManagerAnalyticsTab
				{...baseProps}
				quotaBytesUsed={FIVE_GIB}
				quotaBytesLimit={null}
			/>
		);
		expect(screen.getByText('Used: 5 GB (no limit configured)')).toBeTruthy();
	});
});
