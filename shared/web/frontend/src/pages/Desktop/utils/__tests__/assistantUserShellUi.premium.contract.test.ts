/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Справочник bubble author chips and assistant shell: sentence-case, soft depth.
 *
 * Related:
 * - ../assistantUserShellUi.ts
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */

import { describe, expect, it } from 'vitest';
import {
	ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS,
	ASSISTANT_MESSAGE_AUTHOR_CLASS,
} from '../assistantUserShellUi';
import {
	ASSISTANT_BUBBLE_HOVER_CLASS,
	ASSISTANT_MESSAGE_COMPACT_TOP_CLASS,
} from '../../components/assistant/assistantChatPanelStyles';

describe('assistantUserShellUi premium bubble contract', () => {
	it('keeps author chips sentence-case (no uppercase shout)', () => {
		expect(ASSISTANT_MESSAGE_AUTHOR_CLASS).not.toMatch(/\buppercase\b/);
		expect(ASSISTANT_MESSAGE_AUTHOR_CLASS).toMatch(/tracking-normal/);
		expect(ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS).toMatch(/rounded-full/);
	});

	it('gives assistant bubbles soft sheen depth', () => {
		expect(ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS).toMatch(/before:h-px/);
		expect(ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS).toMatch(/overflow-hidden/);
	});

	it('uses quiet hover without translate bounce', () => {
		expect(ASSISTANT_BUBBLE_HOVER_CLASS).not.toMatch(/translate-y/);
		expect(ASSISTANT_MESSAGE_COMPACT_TOP_CLASS).toBe('-mt-1');
	});
});
