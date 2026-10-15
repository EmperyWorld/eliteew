/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component coverage for Professional Worlds pack import dry-run flow and release approval.
 *
 * Invariants:
 * - Tests mock the admin API boundary and assert the manifest payload sent to dry-run.
 * - Prefer stable `data-testid` hooks for manifest editor and import actions (copy changes with i18n).
 *
 * Related:
 * - PacksTab.tsx
 * - ../api.ts
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
	approveProfessionalWorldsPackRelease: vi.fn(),
	confirmProfessionalWorldsPackImportJob: vi.fn(),
	createProfessionalWorldsPackImportJob: vi.fn(),
	createProfessionalWorldsPackRelease: vi.fn(),
	createProfessionalWorldsPackVersion: vi.fn(),
	diffProfessionalWorldsPackVsLive: vi.fn(),
	exportProfessionalWorldsPack: vi.fn(),
	listProfessionalWorldsPackVersions: vi.fn(),
	publishProfessionalWorldsPackRelease: vi.fn(),
	rollbackProfessionalWorldsPackRelease: vi.fn(),
}));

vi.mock('../api', () => apiMock);

import { PacksTab } from './PacksTab';

describe('PacksTab import dry-run flow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.approveProfessionalWorldsPackRelease.mockResolvedValue({
			id: 'release-1',
		});
		apiMock.listProfessionalWorldsPackVersions.mockResolvedValue([]);
		apiMock.createProfessionalWorldsPackImportJob.mockResolvedValue({
			job: { id: 'job-1', status: 'validated' },
			diff_summary: { changed: 2 },
		});
	});

	it('parses the manifest and sends it to the import dry-run endpoint', async () => {
		const onChanged = vi.fn();
		render(<PacksTab verticalSlug="realtor" onChanged={onChanged} />);

		const manifest = { version: 2, vertical_slug: 'realtor' };
		fireEvent.change(
			await screen.findByTestId('pw-admin-pack-manifest-textarea'),
			{
				target: { value: JSON.stringify(manifest) },
			}
		);
		fireEvent.click(screen.getByTestId('pw-admin-pack-dry-run'));

		await waitFor(() => {
			expect(
				apiMock.createProfessionalWorldsPackImportJob
			).toHaveBeenCalledWith('realtor', manifest);
		});
		expect(onChanged).toHaveBeenCalled();
		expect(await screen.findByText(/job-1/)).toBeInTheDocument();
	});

	it('shows a JSON error and does not call dry-run for invalid manifest text', async () => {
		render(<PacksTab verticalSlug="realtor" onChanged={vi.fn()} />);

		fireEvent.change(
			await screen.findByTestId('pw-admin-pack-manifest-textarea'),
			{
				target: { value: '{"version":' },
			}
		);
		fireEvent.click(screen.getByTestId('pw-admin-pack-dry-run'));

		await waitFor(() => {
			expect(
				apiMock.createProfessionalWorldsPackImportJob
			).not.toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(screen.getByRole('status').textContent).toMatch(
				/JSON error|Ошибка JSON/
			);
		});
	});

	it('uses an accessible confirmation dialog before approving a release', async () => {
		render(<PacksTab verticalSlug="realtor" onChanged={vi.fn()} />);

		fireEvent.change(
			screen.getByPlaceholderText(
				/ID опубликованного релиза|Published release ID/
			),
			{ target: { value: 'release-1' } }
		);
		fireEvent.click(screen.getByTestId('pw-admin-pack-approve-open'));

		const dialog = screen.getByRole('dialog', { name: /release-1/ });
		expect(dialog).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('pw-admin-pack-approve-confirm'));

		await waitFor(() => {
			expect(apiMock.approveProfessionalWorldsPackRelease).toHaveBeenCalledWith(
				'release-1',
				{ comment: null }
			);
		});
	});
});
