/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the Desktop task switcher empty-window state.
 *
 * Invariants:
 * - Opening the task switcher with no windows must explain the state instead of rendering nothing.
 * - Empty-state copy stays localized in `desktopUi`.
 *
 * Related:
 * - src/pages/Desktop/components/TaskSwitcher.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskSwitcher } from '../TaskSwitcher';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	};
});

describe('TaskSwitcher empty state', () => {
	it('shows a localized empty state when no windows are open', () => {
		render(
			<TaskSwitcher
				isOpen={true}
				windows={[]}
				onSelectWindow={vi.fn()}
				onClose={vi.fn()}
			/>
		);

		expect(screen.getByText('taskSwitcher.emptyTitle')).toBeInTheDocument();
		expect(
			screen.getByText('taskSwitcher.emptyDescription')
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'taskSwitcher.emptyAction' })
		).toBeInTheDocument();
	});
});
