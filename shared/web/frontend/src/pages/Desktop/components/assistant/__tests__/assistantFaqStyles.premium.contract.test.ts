/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Assistant FAQ answer label + chat subheader tokens: sentence-case, no shout.
 *
 * Related:
 * - assistantFaqPanelStyles.ts, assistantChatPanelStyles.ts
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */

import { describe, expect, it } from 'vitest';
import { ASSISTANT_CHAT_SUBHEADER_CLASS } from '../assistantChatPanelStyles';
import { ASSISTANT_FAQ_ANSWER_LABEL_CLASS } from '../assistantFaqPanelStyles';

describe('Assistant FAQ / chat premium chrome contract', () => {
	it('keeps FAQ answer label sentence-case (no uppercase shout)', () => {
		expect(ASSISTANT_FAQ_ANSWER_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(ASSISTANT_FAQ_ANSWER_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('softens chat subheader glass strip', () => {
		expect(ASSISTANT_CHAT_SUBHEADER_CLASS).toMatch(/backdrop-blur/);
		expect(ASSISTANT_CHAT_SUBHEADER_CLASS).toMatch(/py-2/);
	});
});
