/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-level contract tests for Professional Worlds app shell wiring that is
 * expensive to mount as a full desktop application.
 *
 * Invariants:
 * - Embedded mobile keeps the reduced navigation contract.
 * - Desktop nav labels use realtor-facing i18n copy, not runtime module names.
 *
 * Related:
 * - ../ProfessionalWorldsApp.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	filterNavItemsForMobileEmbedded,
	isMobileEmbeddedViewAllowed,
} from '../mobileEmbeddedViews';
import {
	pwFormGridClass,
	pwShellBodyClass,
	pwSidebarPanelShellClass,
} from '../layout/professionalWorldsLayoutTokens';

describe('ProfessionalWorldsApp mobile embedded contract', () => {
	it('filters embedded navigation to core mobile views', () => {
		const items = [
			{ id: 'overview' as const, label: 'Overview' },
			{ id: 'profile' as const, label: 'Profile' },
			{ id: 'clients' as const, label: 'Clients' },
			{ id: 'artifacts' as const, label: 'Results' },
			{ id: 'playbooks' as const, label: 'Playbooks' },
			{ id: 'properties' as const, label: 'Objects' },
		];

		expect(
			filterNavItemsForMobileEmbedded(items).map((item) => item.id)
		).toEqual(['overview', 'profile', 'clients', 'artifacts', 'properties']);
		expect(isMobileEmbeddedViewAllowed('playbooks')).toBe(false);
		expect(isMobileEmbeddedViewAllowed('properties')).toBe(true);
	});

	it('uses column shell and single-column workspace grids on embedded', () => {
		expect(pwShellBodyClass(true)).toContain('flex-col');
		expect(pwFormGridClass(true)).not.toContain('md:grid-cols-2');
		expect(pwSidebarPanelShellClass(true)).toContain('overflow-x-auto');
	});

	it('keeps embedded runtime wired into the app shell', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const appSrc = readFileSync(
			join(dir, '../ProfessionalWorldsApp.tsx'),
			'utf8'
		);
		const navSrc = readFileSync(
			join(dir, '../hooks/useProfessionalWorldsNavigationModel.ts'),
			'utf8'
		);
		const shellSrc = readFileSync(
			join(dir, '../ProfessionalWorldsRuntimeShell.tsx'),
			'utf8'
		);

		expect(appSrc).toContain('embeddedMobileLayout');
		expect(appSrc).toContain('enabled: !embeddedMobileLayout');
		expect(navSrc).toContain('filterNavItemsForMobileEmbedded');
		expect(shellSrc).toContain('pwShellBodyClass(embeddedMobile)');
		expect(shellSrc).toContain(
			"layoutMode={embeddedMobile ? 'horizontal' : 'vertical'}"
		);
		expect(shellSrc).toContain('data-professional-worlds-root');
	});

	it('keeps embedded objects workspace read-only with photo upload only', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const shellSrc = readFileSync(
			join(
				dir,
				'../runtimePanels/realtorObjects/RealtorObjectsWorkspaceShell.tsx'
			),
			'utf8'
		);
		const mobilePanelSrc = readFileSync(
			join(
				dir,
				'../runtimePanels/realtorObjects/RealtorObjectsMobilePanel.tsx'
			),
			'utf8'
		);

		expect(shellSrc).toContain('if (embeddedMobileLayout) {');
		expect(shellSrc).toContain('RealtorObjectsMobilePanel');
		expect(mobilePanelSrc).toContain('properties.mobilePhotosLead');
		expect(mobilePanelSrc).not.toContain('photoAdvancedSummary');
		expect(mobilePanelSrc).not.toContain('listingWorkspaceAi');
		expect(mobilePanelSrc).not.toContain('ProfessionalMediaWorkbench');
	});

	it('keeps main desktop navigation on realtor-facing labels', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const navSrc = readFileSync(
			join(dir, '../hooks/useProfessionalWorldsNavigationModel.ts'),
			'utf8'
		);

		expect(navSrc).not.toContain('resolveRuntimeModuleNavLabel');
		for (const labelKey of [
			'nav.profile',
			'nav.properties',
			'nav.clients',
			'nav.learning',
			'nav.brand',
			'nav.playbooks',
			'nav.artifacts',
		]) {
			expect(navSrc).toContain(`label: t('${labelKey}')`);
		}
	});
});
