/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Professional Worlds snapshot mapping and patch helpers.
 */

import { describe, expect, it } from 'vitest';

import {
	integrationKeyToPropertyDraftKind,
	mapProfessionalWorldsSnapshotApiRow,
	markLessonCompletedInSnapshot,
	prependClientToSnapshot,
	upsertPropertyInSnapshot,
} from './professionalWorldsSnapshotUtils';
import type { ProfessionalWorldsSnapshot, RealtorProperty } from './types';

describe('professionalWorldsSnapshotUtils', () => {
	it('maps aggregate API snake_case into Desktop snapshot shape', () => {
		const mapped = mapProfessionalWorldsSnapshotApiRow({
			verticals: [
				{
					slug: 'realtor',
					name: 'Realtor',
					description: null,
					icon_key: 'home',
					profile_schema: {},
					workspace_template: {},
				},
			],
			runtime_config: {
				vertical_slug: 'realtor',
				modules: [],
				schemas: [],
				ai_actions: [],
				photo_presets: [],
				integrations: [],
				playbooks: [],
				config_version_hash: 'abc',
				runtime_epoch: 1,
				active_release_id: null,
			},
			runtime_configs: [
				{
					vertical_slug: 'realtor',
					modules: [],
					schemas: [],
					ai_actions: [],
					photo_presets: [],
					integrations: [],
					playbooks: [],
					config_version_hash: 'abc',
					runtime_epoch: 1,
					active_release_id: null,
				},
			],
			vertical_activations: [],
			profile: null,
			properties: [],
			clients: [],
			deals: [],
			courses: [],
			artifacts: [],
		});
		expect(mapped.runtimeConfig?.vertical_slug).toBe('realtor');
		expect(mapped.runtimeConfigs).toHaveLength(1);
	});

	it('prepends clients without duplicates', () => {
		const base = {
			verticals: [],
			runtimeConfig: null,
			runtimeConfigs: [],
			verticalActivations: [],
			profile: null,
			properties: [],
			clients: [],
			deals: [],
			courses: [],
			artifacts: [],
		} satisfies ProfessionalWorldsSnapshot;
		const client = {
			id: 'c1',
			user_id: 'u1',
			vertical_slug: 'realtor',
			name: 'Anna',
			contact: null,
			need_summary: null,
			budget_from: null,
			budget_to: null,
			preferred_areas: [],
			emotional_motive: null,
			next_action: null,
			status: 'lead',
			created_at: '',
			updated_at: '',
		};
		const next = prependClientToSnapshot(base, client);
		expect(next.clients).toHaveLength(1);
		expect(prependClientToSnapshot(next, client).clients).toHaveLength(1);
	});

	it('normalizes integration keys to property draft kinds', () => {
		expect(integrationKeyToPropertyDraftKind('site_studio')).toBe(
			'site-studio'
		);
		expect(integrationKeyToPropertyDraftKind('unknown')).toBeNull();
	});

	it('upserts properties in place without reordering existing rows', () => {
		const property = {
			id: 'p1',
			user_id: 'u1',
			title: 'Old',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'City',
			district: null,
			address: null,
			price: '100',
			area_m2: '50',
			rooms: 2,
			floor: null,
			total_floors: null,
			view: null,
			infrastructure: [],
			facts: {},
			status: 'draft',
			created_at: '',
			updated_at: '',
		} satisfies RealtorProperty;
		const base = {
			verticals: [],
			runtimeConfig: null,
			runtimeConfigs: [],
			verticalActivations: [],
			profile: null,
			properties: [property],
			clients: [],
			deals: [],
			courses: [],
			artifacts: [],
		} satisfies ProfessionalWorldsSnapshot;
		const updated = { ...property, title: 'New title' };
		const next = upsertPropertyInSnapshot(base, updated);
		expect(next.properties).toHaveLength(1);
		expect(next.properties[0]?.title).toBe('New title');
	});

	it('marks learning lessons completed locally', () => {
		const base = {
			verticals: [],
			runtimeConfig: null,
			runtimeConfigs: [],
			verticalActivations: [],
			profile: null,
			properties: [],
			clients: [],
			deals: [],
			courses: [
				{
					id: 'course-1',
					course_key: 'basics',
					vertical_slug: 'realtor',
					title: 'Basics',
					description: null,
					level: 'intro',
					sort_order: 0,
					lessons: [
						{
							id: 'lesson-1',
							lesson_key: 'intro',
							title: 'Intro',
							summary: null,
							content_md: '',
							exercise: {},
							sort_order: 0,
							completed: false,
						},
					],
				},
			],
			artifacts: [],
		} satisfies ProfessionalWorldsSnapshot;
		const next = markLessonCompletedInSnapshot(base, 'lesson-1');
		expect(next.courses[0]?.lessons?.[0]?.completed).toBe(true);
	});
});
