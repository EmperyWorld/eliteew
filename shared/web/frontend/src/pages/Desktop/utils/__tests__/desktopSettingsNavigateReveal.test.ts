/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for Settings deep-link reveal (ancestor details + font pane).
 *
 * Related:
 * - ../desktopSettingsNavigateReveal.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md
 */

import { describe, expect, it, vi } from 'vitest';
import {
	activateFinetuneFontPaneForElement,
	openAncestorDetailsElements,
	revealDesktopSettingsNavigateTarget,
} from '../desktopSettingsNavigateReveal';

describe('desktopSettingsNavigateReveal', () => {
	it('opens closed ancestor details before the target', () => {
		const outer = document.createElement('details');
		const inner = document.createElement('details');
		const target = document.createElement('div');
		target.id = 'field';
		inner.appendChild(target);
		outer.appendChild(inner);
		document.body.appendChild(outer);

		expect(outer.open).toBe(false);
		expect(inner.open).toBe(false);
		openAncestorDetailsElements(target);
		expect(outer.open).toBe(true);
		expect(inner.open).toBe(true);

		outer.remove();
	});

	it('activates Fine-tune font pane trigger for display field', () => {
		const root = document.createElement('div');
		root.setAttribute('data-testid', 'desktop-settings-finetune-fonts-chooser');
		const trigger = document.createElement('button');
		trigger.setAttribute('data-finetune-font-pane-trigger', 'display');
		const click = vi.fn();
		trigger.addEventListener('click', click);
		const pane = document.createElement('div');
		pane.setAttribute('data-finetune-font-pane', 'display');
		root.appendChild(trigger);
		root.appendChild(pane);
		document.body.appendChild(root);

		activateFinetuneFontPaneForElement(pane);
		expect(click).toHaveBeenCalledTimes(1);

		root.remove();
	});

	it('reveal opens details then activates font pane', () => {
		const details = document.createElement('details');
		const root = document.createElement('div');
		root.setAttribute('data-testid', 'desktop-settings-finetune-fonts-chooser');
		const trigger = document.createElement('button');
		trigger.setAttribute('data-finetune-font-pane-trigger', 'body');
		const click = vi.fn();
		trigger.addEventListener('click', click);
		const pane = document.createElement('div');
		pane.setAttribute('data-finetune-font-pane', 'body');
		root.appendChild(trigger);
		root.appendChild(pane);
		details.appendChild(root);
		document.body.appendChild(details);

		revealDesktopSettingsNavigateTarget(pane);
		expect(details.open).toBe(true);
		expect(click).toHaveBeenCalledTimes(1);

		details.remove();
	});
});
