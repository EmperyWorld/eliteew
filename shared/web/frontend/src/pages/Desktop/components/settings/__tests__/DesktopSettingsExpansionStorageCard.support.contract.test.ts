/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock P0 Settings Advanced IA: storage map last + behind support diagnostics disclosure.
 *
 * Related:
 * - ../expansion/DesktopSettingsExpansionStorageCard.tsx
 * - ../expansion/DesktopSettingsExpansionSection.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsExpansionStorageCard support disclosure', () => {
	it('keeps storage map behind support diagnostics and last in expansion order', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const cardSrc = readFileSync(
			join(dir, '../expansion/DesktopSettingsExpansionStorageCard.tsx'),
			'utf8'
		);
		const sectionSrc = readFileSync(
			join(dir, '../expansion/DesktopSettingsExpansionSection.tsx'),
			'utf8'
		);

		expect(cardSrc).toContain(
			'data-testid="desktop-settings-support-diagnostics"'
		);
		expect(cardSrc).toContain('settingsPanel.supportDiagnosticsTitle');
		expect(cardSrc).not.toContain('cardStorageMapFieldCount');
		expect(cardSrc).toContain('settingsPanel.storageMapFieldCount');

		const storageIdx = sectionSrc.indexOf(
			'DesktopSettingsExpansionStorageCardLazy'
		);
		const workspaceRenderIdx = sectionSrc.lastIndexOf(
			'<DesktopSettingsExpansionWorkspaceCardLazy'
		);
		const assistantIdx = sectionSrc.lastIndexOf(
			'DesktopSettingsExpansionAssistantCardLazy'
		);
		const storageRenderIdx = sectionSrc.lastIndexOf(
			'<DesktopSettingsExpansionStorageCardLazy'
		);
		expect(storageIdx).toBeGreaterThan(-1);
		expect(workspaceRenderIdx).toBeGreaterThan(-1);
		expect(assistantIdx).toBeGreaterThan(-1);
		expect(storageRenderIdx).toBeGreaterThan(assistantIdx);
		expect(storageRenderIdx).toBeGreaterThan(workspaceRenderIdx);

		const powerIdx = sectionSrc.indexOf(
			'data-testid="desktop-settings-power-options"'
		);
		const discoveryRenderIdx = sectionSrc.indexOf(
			'<DesktopSettingsExpansionDiscoveryCardLazy'
		);
		expect(powerIdx).toBeGreaterThan(-1);
		expect(workspaceRenderIdx).toBeLessThan(powerIdx);
		expect(discoveryRenderIdx).toBeGreaterThan(powerIdx);
		expect(discoveryRenderIdx).toBeLessThan(storageRenderIdx);

		const widgetsTabSrc = readFileSync(
			join(dir, '../DesktopSettingsWidgetsTab.tsx'),
			'utf8'
		);
		expect(widgetsTabSrc).toContain(
			'DesktopSettingsExpansionWidgetPanelCardLazy'
		);
	});
});
