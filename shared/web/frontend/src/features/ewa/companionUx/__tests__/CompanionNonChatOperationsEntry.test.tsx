/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for non-chat operations entry state labels.
 *
 * Invariants:
 * - Awaiting confirmation must be visible when chat/composer is hidden.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionNonChatOperationsEntry.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionNonChatOperationsEntry } from '@/features/ewa/companionUx/CompanionNonChatOperationsEntry';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
	}),
}));

describe('CompanionNonChatOperationsEntry', () => {
	it('prioritizes awaiting decision over generic operations count', () => {
		const onOpenOperations = vi.fn();
		render(
			<CompanionNonChatOperationsEntry
				activeOperationCount={3}
				awaitingConfirmationCount={1}
				onOpenOperations={onOpenOperations}
			/>
		);

		expect(screen.getByText('Нужен ответ')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button'));
		expect(onOpenOperations).toHaveBeenCalledOnce();
	});
});
