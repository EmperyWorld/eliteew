/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared field ids and textarea/toggle class tokens for Feedback Hub compose form.
 *
 * Invariants:
 * - Stable element ids for a11y describedby and guided-tour anchors.
 *
 * Related:
 * - FeedbackHubComposeForm.tsx · FEEDBACK-HUB.md
 */
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';

export const FEEDBACK_HUB_MAIN_MESSAGE_FIELD_ID = 'feedback-hub-main';
export const FEEDBACK_HUB_MAIN_MESSAGE_HINT_ID = 'feedback-hub-main-hint';
export const FEEDBACK_HUB_PREVIEW_FIELD_ID = 'feedback-hub-preview';
export const FEEDBACK_HUB_CHAR_COUNTER_ID = 'feedback-hub-char-counter';
export const FEEDBACK_HUB_SEND_SHORTCUT_HINT_ID = 'feedback-hub-send-shortcut';
export const FEEDBACK_HUB_STRUCTURE_SECTION_ID = 'feedback-hub-structure';

export const feedbackHubWishFieldId = (wk: string) => `feedback-hub-wish-${wk}`;
export const feedbackHubBugFieldId = (k: string) => `feedback-hub-bug-${k}`;

export const FEEDBACK_HUB_SECTION_HEADING_CLASS = cn(
	DESKTOP_TYPOGRAPHY.body,
	'font-semibold text-(--desktop-text-primary)'
);

export const FEEDBACK_HUB_FORM_TEXTAREA_CLASS = cn(
	'w-full resize-y border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) leading-relaxed',
	DESKTOP_TYPOGRAPHY.body,
	'text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const FEEDBACK_HUB_PREVIEW_TEXTAREA_CLASS = cn(
	FEEDBACK_HUB_FORM_TEXTAREA_CLASS,
	'rounded-(--desktop-radius-lg) bg-(--desktop-surface-soft)/90 px-3 py-2.5 cursor-default'
);

export const FEEDBACK_HUB_KIND_TOGGLE_BUTTON_CLASS = cn(
	'flex items-center justify-center gap-2 rounded-(--desktop-radius) px-3 py-2.5 transition-colors',
	DESKTOP_TYPOGRAPHY.body,
	'font-medium',
	DESKTOP_CHROME_FOCUS_VISIBLE
);
