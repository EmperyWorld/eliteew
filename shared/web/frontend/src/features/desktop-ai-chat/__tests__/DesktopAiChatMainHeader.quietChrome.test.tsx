/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock premium quiet header: settings gear + overflow «⋯»; no equal-weight export/delete icons.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiChatMainHeader } from '../components/DesktopAiChatMainHeader';

vi.mock('../components/desktopAiChatIconTooltip', () => ({
	DesktopAiChatIconTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('@/pages/Desktop/components/DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('@/pages/Desktop/components/DesktopAppChrome', () => ({
	DesktopAppMenuSurface: ({
		children,
		...rest
	}: {
		children: React.ReactNode;
	}) => (
		<div data-testid="desktop-ai-chat-header-more-menu" {...rest}>
			{children}
		</div>
	),
	DesktopAppMenuItem: ({
		children,
		onClick,
		disabled,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		disabled?: boolean;
	}) => (
		<button type="button" onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));

vi.mock('../components/DesktopAiChatHumanRosterStack', () => ({
	DesktopAiChatHumanRosterStack: () => null,
}));

const t = ((key: string) => key) as unknown as TFunction<'desktopAiChat'>;

describe('DesktopAiChatMainHeader quiet chrome', () => {
	it('exposes settings toggle and overflow menu; guide/export live under more', () => {
		const onOpenGuide = vi.fn();
		const onExportMd = vi.fn();

		render(
			<DesktopAiChatMainHeader
				isCompactSurface={false}
				shellHeaderBarClusterClass="header-bar"
				shellHeaderCollapseBtnClass="collapse-btn"
				isEnsembleActive={false}
				ensembleRosterHeroes={[]}
				assistantHeaderLabel="Assistant"
				ensembleRosterSubtitle=""
				activeHeroAvatarPath={null}
				activeChat={{ id: 'c1' } as never}
				currentUserId={null}
				soloSlotCountdownLabel={null}
				soloCanReleaseConsultant={false}
				releaseConsultantBusy={false}
				sending={false}
				headerCollapsed
				activeId="c1"
				messagesCount={2}
				onOpenRosterHeroDossier={vi.fn()}
				onOpenHeroDossier={vi.fn()}
				onOpenReleaseConsultantModal={vi.fn()}
				onOpenEnsemblePlanCommands={vi.fn()}
				onToggleHeaderCollapsed={vi.fn()}
				onExportMd={onExportMd}
				onDeleteChat={vi.fn()}
				onOpenMembersPanel={vi.fn()}
				onRequestLeaveChat={vi.fn()}
				canManageMembers={false}
				canLeave={false}
				canDeleteChat
				canExport
				onOpenGuide={onOpenGuide}
				lucideStroke={1.5}
				t={t}
			/>
		);

		expect(screen.getByTestId('desktop-ai-chat-settings-toggle')).toBeTruthy();
		expect(screen.queryByLabelText('exportMdAria')).toBeNull();

		fireEvent.click(screen.getByTestId('desktop-ai-chat-header-more'));
		expect(screen.getByTestId('desktop-ai-chat-header-more-menu')).toBeTruthy();

		fireEvent.click(screen.getByText('openGuideMenu'));
		expect(onOpenGuide).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId('desktop-ai-chat-header-more'));
		fireEvent.click(screen.getByText('exportMdAria'));
		expect(onExportMd).toHaveBeenCalledTimes(1);
	});

	it('shows human names in primary color and compact AI roster in accent (not uppercase)', () => {
		const tLocal = ((key: string) => {
			if (key === 'messageFromYouTitle') return 'You';
			return key;
		}) as unknown as TFunction<'desktopAiChat'>;

		render(
			<DesktopAiChatMainHeader
				isCompactSurface={false}
				shellHeaderBarClusterClass="header-bar"
				shellHeaderCollapseBtnClass="collapse-btn"
				isEnsembleActive
				ensembleRosterHeroes={[]}
				assistantHeaderLabel="Team"
				ensembleRosterSubtitle="Ликий · Соренто · Макс"
				activeHeroAvatarPath={null}
				activeChat={
					{
						id: 'c1',
						participants: [
							{
								user_id: 'u1',
								display_name: 'Alice',
								avatar_url: null,
								is_owner: true,
							},
							{
								user_id: 'u2',
								display_name: 'Bob',
								avatar_url: null,
								is_owner: false,
							},
						],
					} as never
				}
				currentUserId="u1"
				soloSlotCountdownLabel={null}
				soloCanReleaseConsultant={false}
				releaseConsultantBusy={false}
				sending={false}
				headerCollapsed
				activeId="c1"
				messagesCount={0}
				onOpenRosterHeroDossier={vi.fn()}
				onOpenHeroDossier={vi.fn()}
				onOpenReleaseConsultantModal={vi.fn()}
				onOpenEnsemblePlanCommands={vi.fn()}
				onToggleHeaderCollapsed={vi.fn()}
				onExportMd={vi.fn()}
				onDeleteChat={vi.fn()}
				onOpenMembersPanel={vi.fn()}
				onRequestLeaveChat={vi.fn()}
				canManageMembers
				canLeave={false}
				canDeleteChat
				canExport
				onOpenGuide={vi.fn()}
				lucideStroke={1.75}
				t={tLocal}
			/>
		);

		const human = screen.getByText(/You · Bob/);
		expect(human.className).toContain('text-(--desktop-text-primary)');
		const ai = screen.getByText(/Ликий · Соренто · \+1/);
		expect(ai.className).toContain('desktop-accent-rgb');
		expect(ai.className).not.toContain('uppercase');
	});
});
