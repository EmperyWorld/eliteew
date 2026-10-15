/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke test for ContentManagerUploadQueuePanel rendering.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentManagerUploadQueuePanel } from '../components/ContentManagerUploadQueuePanel';
import { renderWithCmProHarness } from './cmProTestHarness';

describe('ContentManagerUploadQueuePanel smoke', () => {
	it('renders queue items with retry for failed upload', () => {
		const file = new File(['x'], 'fail.txt', { type: 'text/plain' });
		renderWithCmProHarness(
			<ContentManagerUploadQueuePanel
				queue={[
					{
						id: 'q1',
						file,
						status: 'failed',
						errorMessage: 'network',
					},
				]}
				retryFile={vi.fn()}
				clearQueue={vi.fn()}
				uploading={false}
			/>
		);

		expect(screen.getByText('fail.txt')).toBeTruthy();
		const buttons = screen.getAllByRole('button');
		expect(buttons.length).toBeGreaterThanOrEqual(1);
	});
});
