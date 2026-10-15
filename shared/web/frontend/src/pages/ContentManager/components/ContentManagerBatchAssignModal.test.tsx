/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests batch assign modal validation for Content Manager bulk actions.
 *
 * Invariants:
 * - Apply cannot run until both company and project are selected.
 *
 * Related:
 * - `ContentManagerBatchAssignModal.tsx`
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentManagerBatchAssignModal } from './ContentManagerBatchAssignModal';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

beforeAll(() => {
	class MockAudioContext {
		state = 'running';
		resume = vi.fn().mockResolvedValue(undefined);
	}
	(
		globalThis as unknown as { AudioContext: typeof MockAudioContext }
	).AudioContext = MockAudioContext;
});

describe('ContentManagerBatchAssignModal', () => {
	it('disables Apply until company and project are selected', () => {
		const onApply = vi.fn();
		const onCompanyChange = vi.fn();
		const onProjectChange = vi.fn();

		render(
			<ContentManagerBatchAssignModal
				open
				embedded={false}
				loading={false}
				assignCompanyId=""
				assignProjectId=""
				onCompanyChange={onCompanyChange}
				onProjectChange={onProjectChange}
				onClose={vi.fn()}
				onApply={onApply}
				companies={[{ id: 'company-1', name: 'Acme' }]}
				projects={[
					{ id: 'project-1', company_id: 'company-1', name: 'Launch' },
				]}
				loadingCompanies={false}
				loadingProjects={false}
			/>
		);

		const apply = screen.getByRole('button', {
			name: /pro\.batchAssign\.apply/,
		});
		expect(apply).toBeDisabled();
		expect(
			screen.getByText('pro.batchAssign.pickCompanyFirst')
		).toBeInTheDocument();
		fireEvent.click(apply);
		expect(onApply).not.toHaveBeenCalled();
	});

	it('enables Apply when company and project are selected', () => {
		const onApply = vi.fn();

		render(
			<ContentManagerBatchAssignModal
				open
				embedded={false}
				loading={false}
				assignCompanyId="company-1"
				assignProjectId="project-1"
				onCompanyChange={vi.fn()}
				onProjectChange={vi.fn()}
				onClose={vi.fn()}
				onApply={onApply}
				companies={[{ id: 'company-1', name: 'Acme' }]}
				projects={[
					{ id: 'project-1', company_id: 'company-1', name: 'Launch' },
				]}
				loadingCompanies={false}
				loadingProjects={false}
			/>
		);

		const apply = screen.getByRole('button', {
			name: /pro\.batchAssign\.apply/,
		});
		expect(apply).toBeEnabled();
		expect(screen.getByText('pro.batchAssign.ready')).toBeInTheDocument();

		fireEvent.click(apply);
		expect(onApply).toHaveBeenCalledTimes(1);
	});
});
