/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for GAF Chat main column chrome (empty / resolving states).
 *
 * Invariants:
 * - No-chat empty copy and opening-chat spinner stay mutually exclusive.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatMainColumnChrome.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GafChatMainColumnChrome } from '../GafChatMainColumnChrome';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('GafChatMainColumnChrome', () => {
	it('renders no-chat empty state when no chat selected', () => {
		render(
			<GafChatMainColumnChrome
				shellMainColumnClass="main-col"
				gafPortalRoot={null}
				setGafPortalRoot={() => {}}
				selectedChatId={null}
				resolvingInitialUsername={false}
				activeThreadContent={<div data-testid="active-thread" />}
			/>
		);

		expect(screen.getByText('noChatSelectedTitle')).toBeInTheDocument();
		expect(screen.getByText('noChatSelectedDescription')).toBeInTheDocument();
		expect(screen.queryByTestId('active-thread')).not.toBeInTheDocument();
	});

	it('renders opening spinner while resolving initial username', () => {
		render(
			<GafChatMainColumnChrome
				shellMainColumnClass="main-col"
				gafPortalRoot={null}
				setGafPortalRoot={() => {}}
				selectedChatId={null}
				resolvingInitialUsername
				activeThreadContent={<div data-testid="active-thread" />}
			/>
		);

		expect(screen.getByText('openingChat')).toBeInTheDocument();
		expect(screen.queryByText('noChatSelectedTitle')).not.toBeInTheDocument();
	});

	it('renders active thread slot when chat is selected', () => {
		render(
			<GafChatMainColumnChrome
				shellMainColumnClass="main-col"
				gafPortalRoot={null}
				setGafPortalRoot={() => {}}
				selectedChatId="chat-1"
				resolvingInitialUsername={false}
				activeThreadContent={<div data-testid="active-thread" />}
			/>
		);

		expect(screen.getByTestId('active-thread')).toBeInTheDocument();
		expect(screen.queryByText('noChatSelectedTitle')).not.toBeInTheDocument();
	});
});
