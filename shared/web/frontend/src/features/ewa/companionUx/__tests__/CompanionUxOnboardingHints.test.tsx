/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for companion UX onboarding hints v2 (dismiss + Try callbacks).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionUxOnboardingHints.tsx
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	function createMemoryStorage(): Storage {
		let store: Record<string, string> = {};
		return {
			get length() {
				return Object.keys(store).length;
			},
			clear() {
				store = {};
			},
			getItem(key: string) {
				return store[key] ?? null;
			},
			setItem(key: string, value: string) {
				store[key] = String(value);
			},
			removeItem(key: string) {
				delete store[key];
			},
			key(index: number) {
				return Object.keys(store)[index] ?? null;
			},
		};
	}
	vi.stubGlobal('localStorage', createMemoryStorage());
});

import { CompanionUxOnboardingHints } from '@/features/ewa/companionUx/CompanionUxOnboardingHints';

const labels: Record<string, string> = {
	'ewaCompanion.uxOnboarding.title': 'Quick tour',
	'ewaCompanion.uxOnboarding.dismissAll': 'Dismiss all',
	'ewaCompanion.uxOnboarding.try': 'Try',
	'ewaCompanion.uxOnboarding.skip': 'Skip',
	'ewaCompanion.uxOnboarding.steps.tools': 'Open tools catalog',
	'ewaCompanion.uxOnboarding.steps.workflows': 'Browse workflows',
	'ewaCompanion.uxOnboarding.steps.operations': 'Track operations',
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => labels[key] ?? key,
	}),
}));

describe('CompanionUxOnboardingHints', () => {
	afterEach(() => {
		localStorage.clear();
	});

	it('dismisses a step on Try and invokes the matching callback', () => {
		const onOpenTools = vi.fn();
		render(
			<CompanionUxOnboardingHints
				principalId="principal-a"
				onOpenTools={onOpenTools}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
			/>
		);

		fireEvent.click(
			screen.getAllByRole('button', {
				name: labels['ewaCompanion.uxOnboarding.try'],
			})[0]
		);
		expect(onOpenTools).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('Open tools catalog')).not.toBeInTheDocument();
		expect(screen.getByText('Browse workflows')).toBeInTheDocument();
	});

	it('persists dismissed steps per principal across remount', () => {
		const props = {
			principalId: 'principal-b',
			onOpenTools: vi.fn(),
			onOpenWorkflows: vi.fn(),
			onOpenOperations: vi.fn(),
		};
		const { unmount } = render(<CompanionUxOnboardingHints {...props} />);
		const toolsRow = screen.getByText('Open tools catalog').closest('li');
		if (!toolsRow) throw new Error('Expected tools onboarding row');
		fireEvent.click(within(toolsRow).getByRole('button', { name: 'Skip' }));
		unmount();
		render(<CompanionUxOnboardingHints {...props} />);
		expect(screen.queryByText('Open tools catalog')).not.toBeInTheDocument();
		expect(screen.getByText('Browse workflows')).toBeInTheDocument();
	});
});
