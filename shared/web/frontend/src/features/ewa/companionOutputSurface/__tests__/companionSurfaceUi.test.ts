/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion surface UI helpers.
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_CHROME_TRANSITION_CLASS,
	COMPANION_SLIM_CHAT_DOCK_SHELL_CLASS,
	isCompanionComposerVisible,
	isCompanionSlimChatDockVisible,
	isCompanionSurfacePanelMode,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';

describe('companionSurfaceUi', () => {
	it('shows composer only in chat mode', () => {
		expect(isCompanionComposerVisible('chat')).toBe(true);
		expect(isCompanionComposerVisible('workflow_dag_builder')).toBe(false);
		expect(isCompanionComposerVisible('workflow_edit')).toBe(false);
	});

	it('shows slim chat dock on workspace surfaces', () => {
		expect(isCompanionSlimChatDockVisible('chat')).toBe(false);
		expect(isCompanionSlimChatDockVisible('document_editor')).toBe(true);
		expect(isCompanionSlimChatDockVisible('workflow_edit')).toBe(true);
		expect(isCompanionSlimChatDockVisible('music_xl_base_wizard')).toBe(true);
	});

	it('treats non-chat modes as surface panels', () => {
		expect(isCompanionSurfacePanelMode('chat')).toBe(false);
		expect(isCompanionSurfacePanelMode('roadmap')).toBe(true);
	});

	it('exports shared chrome transition and slim-dock shell tokens', () => {
		expect(COMPANION_CHROME_TRANSITION_CLASS).toContain('duration-150');
		expect(COMPANION_CHROME_TRANSITION_CLASS).toContain(
			'motion-reduce:transition-none'
		);
		expect(COMPANION_SLIM_CHAT_DOCK_SHELL_CLASS).toContain('rounded-xl');
		expect(COMPANION_SLIM_CHAT_DOCK_SHELL_CLASS).toContain(
			'border-(--companion-divider)/80'
		);
	});
});
