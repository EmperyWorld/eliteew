/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ensemble header roster: click each stacked avatar opens that hero's dossier.
 *
 * Invariants:
 * - Must not always dispatch roster[0] regardless of which face was clicked.
 *
 * Related:
 * - components/DesktopAiChatMainHeader.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiChatMainHeader } from '../components/DesktopAiChatMainHeader';
import { DESKTOP_AI_HEROES } from '../desktopAiHeroes';

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
		<div data-testid="mock-menu-surface" {...rest}>
			{children}
		</div>
	),
	DesktopAppMenuItem: ({
		children,
		onClick,
		disabled,
		...rest
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		disabled?: boolean;
	}) => (
		<button type="button" onClick={onClick} disabled={disabled} {...rest}>
			{children}
		</button>
	),
}));

const roster = DESKTOP_AI_HEROES.slice(0, 3);

function renderHeader(onOpenRosterHeroDossier: (heroId: string) => void): void {
	const t = ((key: string, opts?: { name?: string }) => {
		if (key === 'ensembleRosterHeroAria') {
			return `About ${opts?.name ?? ''}`;
		}
		if (key === 'ensembleGroupMembersAria') {
			return 'Group members';
		}
		return key;
	}) as unknown as TFunction<'desktopAiChat'>;

	render(
		<DesktopAiChatMainHeader
			isCompactSurface={false}
			shellHeaderBarClusterClass="header-bar"
			shellHeaderCollapseBtnClass="collapse-btn"
			isEnsembleActive
			ensembleRosterHeroes={roster}
			assistantHeaderLabel="Team"
			ensembleRosterSubtitle="A · B · C"
			activeHeroAvatarPath={null}
			activeChat={{ id: 'c1' } as never}
			currentUserId={null}
			soloSlotCountdownLabel={null}
			soloCanReleaseConsultant={false}
			releaseConsultantBusy={false}
			sending={false}
			headerCollapsed
			activeId="c1"
			messagesCount={0}
			onOpenRosterHeroDossier={onOpenRosterHeroDossier}
			onOpenHeroDossier={vi.fn()}
			onOpenReleaseConsultantModal={vi.fn()}
			onOpenEnsemblePlanCommands={vi.fn()}
			onToggleHeaderCollapsed={vi.fn()}
			onExportMd={vi.fn()}
			onDeleteChat={vi.fn()}
			onOpenMembersPanel={vi.fn()}
			onRequestLeaveChat={vi.fn()}
			canManageMembers={false}
			canLeave={false}
			canDeleteChat
			canExport
			onOpenGuide={vi.fn()}
			lucideStroke={1.5}
			t={t}
		/>
	);
}

describe('DesktopAiChatMainHeader ensemble roster dossier', () => {
	it('opens the clicked roster hero, not always the first', () => {
		const onOpenRosterHeroDossier = vi.fn();
		renderHeader(onOpenRosterHeroDossier);

		fireEvent.click(
			screen.getByRole('button', { name: `About ${roster[1].label}` })
		);
		expect(onOpenRosterHeroDossier).toHaveBeenCalledTimes(1);
		expect(onOpenRosterHeroDossier).toHaveBeenCalledWith(roster[1].id);

		fireEvent.click(
			screen.getByRole('button', { name: `About ${roster[2].label}` })
		);
		expect(onOpenRosterHeroDossier).toHaveBeenLastCalledWith(roster[2].id);
	});
});
