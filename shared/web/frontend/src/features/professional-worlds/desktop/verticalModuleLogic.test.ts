/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for vertical-pack module routing and listing workspace gates.
 *
 * Invariants:
 * - Tests stay free of Desktop mount; pure helpers only.
 *
 * Related:
 * - verticalModuleLogic.ts
 */

import { describe, expect, it } from 'vitest';

import {
	isVerticalPackAddonModuleKey,
	resolveRuntimeModuleNavLabel,
	resolveRuntimeModuleUserLabel,
	sortedEnabledVerticalAddonModules,
	verticalSupportsListingWorkspace,
} from './verticalModuleLogic';
import type { ProfessionalRuntimeModule } from './types';

function mod(
	moduleKey: string,
	sortOrder: number,
	enabled = true
): ProfessionalRuntimeModule {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		vertical_slug: 'realtor',
		module_key: moduleKey,
		module_name: moduleKey,
		module_category: 'crm',
		icon_key: null,
		config: {},
		sort_order: sortOrder,
		is_enabled: enabled,
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	};
}

describe('verticalModuleLogic', () => {
	it('detects vertical-pack addon keys by slug prefix', () => {
		expect(isVerticalPackAddonModuleKey('realtor_leads', 'realtor')).toBe(true);
		expect(isVerticalPackAddonModuleKey('clients', 'realtor')).toBe(false);
		expect(isVerticalPackAddonModuleKey('realtor_leads', 'testo')).toBe(false);
	});

	it('sorts enabled realtor pack addons and skips core modules', () => {
		expect(
			sortedEnabledVerticalAddonModules(
				[
					mod('realtor_tasks', 40),
					mod('clients', 10),
					mod('realtor_leads', 25),
					mod('realtor_playbooks', 99),
					mod('profile', 5),
				],
				'realtor'
			).map((m) => m.module_key)
		).toEqual(['realtor_leads', 'realtor_tasks']);
	});

	it('excludes unknown vertical-pack keys without registry panels', () => {
		expect(
			sortedEnabledVerticalAddonModules(
				[mod('realtor_unknown_future', 1)],
				'realtor'
			)
		).toEqual([]);
	});

	it('prefers runtime module_name for nav labels', () => {
		expect(
			resolveRuntimeModuleNavLabel(
				{ ...mod('objects', 1), module_name: 'Каталог объектов' },
				'Объекты'
			)
		).toBe('Каталог объектов');
		expect(resolveRuntimeModuleNavLabel(undefined, 'Объекты')).toBe('Объекты');
	});

	it('keeps generic AI runtime names from overriding localized playbooks copy', () => {
		expect(
			resolveRuntimeModuleNavLabel(
				{ ...mod('realtor_playbooks', 1), module_name: 'AI Playbooks' },
				'Сценарии'
			)
		).toBe('Сценарии');
		expect(
			resolveRuntimeModuleNavLabel(
				{ ...mod('realtor_playbooks', 1), module_name: 'AI-плейбуки' },
				'Сценарии'
			)
		).toBe('Сценарии');
		expect(
			resolveRuntimeModuleNavLabel(
				{ ...mod('realtor_playbooks', 1), module_name: 'Сделочные сценарии' },
				'Сценарии'
			)
		).toBe('Сделочные сценарии');
	});

	it('prefers localized profession tool labels for locked nav hints', () => {
		const t = ((key: string) =>
			key === 'professionTools.modules.realtor_pipeline.label'
				? 'Воронка'
				: key) as never;
		expect(
			resolveRuntimeModuleUserLabel(
				t,
				'realtor_pipeline',
				undefined,
				'Pipeline'
			)
		).toBe('Воронка');
	});

	it('gates listing workspace on objects module and realtor API', () => {
		expect(
			verticalSupportsListingWorkspace('realtor', [mod('objects', 1)])
		).toBe(true);
		expect(
			verticalSupportsListingWorkspace('realtor', [mod('profile', 1)])
		).toBe(false);
		expect(verticalSupportsListingWorkspace('testo', [mod('objects', 1)])).toBe(
			false
		);
	});
});
