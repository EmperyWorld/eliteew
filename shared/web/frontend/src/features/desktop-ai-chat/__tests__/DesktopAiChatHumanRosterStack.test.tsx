/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock human participant stack: renders initials and overflow chip for header/sidebar.
 *
 * Related:
 * - components/DesktopAiChatHumanRosterStack.tsx
 */
import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiChatHumanRosterStack } from '../components/DesktopAiChatHumanRosterStack';

vi.mock('@/pages/Desktop/components/DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('@/components/profile/SecureAvatar', () => ({
	SecureAvatar: ({ alt }: { alt: string }) => (
		<img alt={alt} data-testid="secure-avatar" />
	),
}));

describe('DesktopAiChatHumanRosterStack', () => {
	it('renders participant initials and overflow', () => {
		render(
			<DesktopAiChatHumanRosterStack
				participants={[
					{
						user_id: 'u1',
						display_name: 'Alice Owner',
						avatar_url: null,
						is_owner: true,
					},
					{
						user_id: 'u2',
						display_name: 'Bob Guest',
						avatar_url: '/a.png',
						is_owner: false,
					},
					{
						user_id: 'u3',
						display_name: 'Cara',
						avatar_url: null,
						is_owner: false,
					},
					{
						user_id: 'u4',
						display_name: 'Dan',
						avatar_url: null,
						is_owner: false,
					},
					{
						user_id: 'u5',
						display_name: 'Eve',
						avatar_url: null,
						is_owner: false,
					},
				]}
				currentUserId="u2"
				youLabel="You"
				maxVisible={4}
			/>
		);

		expect(screen.getByText('AO')).toBeTruthy();
		expect(screen.getByTestId('secure-avatar')).toBeTruthy();
		expect(screen.getByText('+1')).toBeTruthy();
	});
});
