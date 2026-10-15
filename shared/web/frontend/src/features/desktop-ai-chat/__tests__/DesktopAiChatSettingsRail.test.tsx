/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendering tests for Desktop AI Chat settings rail basic/advanced split.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DESKTOP_AI_CHAT_PROJECT_MENU_ID } from '../desktopAiChatDomIds';
import { DesktopAiChatSettingsRail } from '../components/DesktopAiChatSettingsRail';
import type { DesktopAiChatItem } from '../api/desktopChatClient';

const t = ((key: string) =>
	key) as import('i18next').TFunction<'desktopAiChat'>;

const activeChatFixture: DesktopAiChatItem = {
	id: 'chat-1',
	user_id: 'user-1',
	company_id: null,
	project_id: '00000000-0000-0000-0000-000000000099',
	title: 'Test',
	llama_model: null,
	system_prompt_override: null,
	use_project_rag: false,
	vault_rag_eligible: false,
	settings: {},
	created_at: null,
	updated_at: null,
};
function baseProps(
	overrides: Partial<
		React.ComponentProps<typeof DesktopAiChatSettingsRail>
	> = {}
): React.ComponentProps<typeof DesktopAiChatSettingsRail> {
	const {
		canPatchSettings = true,
		canManageProject = true,
		...rest
	} = overrides;
	return {
		activeChat: activeChatFixture,
		settings: { tools_web_search_enabled: true },
		useProjectRag: false,
		setUseProjectRag: vi.fn(),
		projectId: '00000000-0000-0000-0000-000000000099',
		projectMenuRef: { current: null },
		projectMenuOpen: false,
		setProjectMenuOpen: vi.fn(),
		projectQuery: '',
		setProjectQuery: vi.fn(),
		projectSearchInputRef: { current: null },
		filteredProjects: [],
		selectedProjectName: null,
		onApplyProjectBinding: vi.fn(),
		useTools: true,
		useWebSearch: false,
		voiceIn: false,
		voiceOut: false,
		voiceAllowed: true,
		setPanelPref: vi.fn(),
		toolsHint: 'hint',
		isEnsembleActive: false,
		ensembleRoutingMenuRef: { current: null },
		ensembleRoutingMenuOpen: false,
		ensembleRoutingMode: 'auto' as const,
		ensembleRoutingModeLabel: 'auto',
		ensembleRoutingBusy: false,
		onEnsembleRoutingToggle: vi.fn(),
		onEnsembleRoutingSelect: vi.fn(),
		onCloseEnsembleRoutingMenu: vi.fn(),
		t,
		lucideStroke: 1.5,
		...rest,
		canPatchSettings,
		canManageProject,
	};
}

describe('DesktopAiChatSettingsRail', () => {
	it('keeps voice and tools toggles in one compact wrap row', () => {
		const { container } = render(
			<DesktopAiChatSettingsRail {...baseProps()} />
		);
		const row = container.querySelector(
			'[data-ai-chat-guide="voice-settings"]'
		);
		expect(row).toBeTruthy();
		expect(row?.querySelector('#desktop-ai-chat-voice-in')).toBeTruthy();
		expect(row?.querySelector('#desktop-ai-chat-smart-tools')).toBeTruthy();
		expect(row?.querySelector('#desktop-ai-chat-web-search')).toBeTruthy();
	});

	it('shows basic voice and tools toggles outside advanced block', () => {
		render(<DesktopAiChatSettingsRail {...baseProps()} />);
		expect(screen.getByText('settingsBasicTitle')).toBeTruthy();
		expect(screen.getByLabelText('voiceInLabel')).toBeTruthy();
		expect(screen.getByLabelText('smartToolsLabel')).toBeTruthy();
		expect(screen.getByText('settingsAdvancedTitle')).toBeTruthy();
	});

	it('never shows raw project id slice in picker label', () => {
		render(
			<DesktopAiChatSettingsRail
				{...baseProps({ selectedProjectName: null })}
			/>
		);
		expect(screen.queryByText(/00000000/)).toBeNull();
		expect(screen.getByText('contextProjectBound')).toBeTruthy();
	});

	it('exposes project menu a11y ids on the picker button', () => {
		render(<DesktopAiChatSettingsRail {...baseProps()} />);
		const btn = screen.getByRole('button', { name: 'contextProjectBound' });
		expect(btn.getAttribute('aria-controls')).toBe(
			DESKTOP_AI_CHAT_PROJECT_MENU_ID
		);
		expect(btn.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows vault ineligible hint when project bound but not eligible', () => {
		render(<DesktopAiChatSettingsRail {...baseProps()} />);
		fireEvent.click(screen.getByText('settingsAdvancedTitle'));
		expect(screen.getByText('vaultRagNotEligibleHint')).toBeTruthy();
	});
});
