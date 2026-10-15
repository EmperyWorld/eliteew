/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for widget slot user-facing copy helpers.
 *
 * Invariants:
 * - Missing help keys return undefined, not the raw i18n path.
 *
 * Related:
 * - `desktopSettingsWidgetSlotCopy.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	buildDesktopWidgetSlotHelpText,
	buildDesktopWidgetSlotLabel,
	resolveDesktopWidgetSlotTypeId,
} from '../expansion/desktopSettingsWidgetSlotCopy';

describe('desktopSettingsWidgetSlotCopy', () => {
	const t = (key: string, options?: { defaultValue?: string }) =>
		({
			'settingsPanel.widgetSlot.favorites': 'Favorites',
			'settingsPanel.widgetSlotDesc.favorites':
				'Pinned links you add from the panel.',
		})[key] ??
		options?.defaultValue ??
		key;

	it('resolves slot type from wire shape', () => {
		expect(
			resolveDesktopWidgetSlotTypeId({ id: 'slot-1', type: 'favorites' })
		).toBe('favorites');
		expect(resolveDesktopWidgetSlotTypeId({ id: 'notes', type: 'notes' })).toBe(
			'notes'
		);
	});

	it('builds label and favorites help text', () => {
		expect(buildDesktopWidgetSlotLabel(t, 'favorites')).toBe('Favorites');
		expect(buildDesktopWidgetSlotHelpText(t, 'favorites')).toBe(
			'Pinned links you add from the panel.'
		);
	});

	it('resolves assistant-plan and agenda type ids', () => {
		expect(
			resolveDesktopWidgetSlotTypeId({
				id: 'assistant-plan',
				type: 'assistant-plan',
			})
		).toBe('assistant-plan');
		expect(
			resolveDesktopWidgetSlotTypeId({ id: 'agenda', type: 'agenda' })
		).toBe('agenda');
	});

	it('returns undefined when help copy is missing', () => {
		expect(buildDesktopWidgetSlotHelpText(t, 'unknown-slot')).toBeUndefined();
	});
});
